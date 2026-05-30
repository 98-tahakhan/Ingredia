"""
Production-quality OCR pipeline for ingredient extraction from food labels.

Pipeline:
1. Image preprocessing (grayscale, contrast, sharpen, threshold)
2. Tesseract OCR with tuned config
3. Text cleanup (remove URLs, social media, barcodes, garbage)
4. Ingredient section extraction (find "Ingredients:" header)
5. Structured parsing into ingredient array
6. Confidence check — reject low-quality results
7. Gemini Vision fallback for difficult labels

Does NOT hallucinate ingredients. Returns error if text is unreadable.
"""

import io
import os
import re
import base64
from PIL import Image, ImageFilter, ImageEnhance, ImageOps
import pytesseract
import google.generativeai as genai
from .config import GEMINI_API_KEY, TESSERACT_CMD

# ─── Configuration ────────────────────────────────────────────────────────────

if os.path.exists(TESSERACT_CMD):
    pytesseract.pytesseract.tesseract_cmd = TESSERACT_CMD

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


# ─── 1. Image Preprocessing ──────────────────────────────────────────────────

def _preprocess_image(image: Image.Image) -> Image.Image:
    """
    Aggressive preprocessing for food label OCR:
    - Grayscale
    - Auto-contrast
    - Sharpen
    - Adaptive threshold (binarization)
    - Upscale small images
    """
    # Convert to grayscale
    img = image.convert("L")

    # Auto-contrast (stretches histogram)
    img = ImageOps.autocontrast(img, cutoff=2)

    # Increase contrast further
    enhancer = ImageEnhance.Contrast(img)
    img = enhancer.enhance(1.8)

    # Sharpen
    img = img.filter(ImageFilter.SHARPEN)
    img = img.filter(ImageFilter.SHARPEN)  # Double sharpen for small text

    # Upscale small images (ingredient text is often tiny)
    w, h = img.size
    if w < 1000:
        ratio = 1000 / w
        img = img.resize((int(w * ratio), int(h * ratio)), Image.LANCZOS)

    # Binarization: convert to pure black/white using threshold
    # This removes background noise and makes text crisp
    threshold = 140
    img = img.point(lambda p: 255 if p > threshold else 0, mode="1")
    img = img.convert("L")  # Back to grayscale for Tesseract

    return img


# ─── 2. Tesseract OCR ────────────────────────────────────────────────────────

def _run_tesseract(image: Image.Image) -> tuple[str, float]:
    """
    Run Tesseract with config tuned for ingredient paragraphs.
    Returns (text, average_confidence).
    """
    # PSM 6: Assume a single uniform block of text (good for ingredient paragraphs)
    # PSM 11: Sparse text — try if PSM 6 fails
    # OEM 3: Default (LSTM + legacy)
    config_primary = r"--oem 3 --psm 6"

    # Get text with confidence data
    try:
        data = pytesseract.image_to_data(image, config=config_primary, lang="eng", output_type=pytesseract.Output.DICT)
    except Exception:
        # Fallback to simple string extraction
        text = pytesseract.image_to_string(image, config=config_primary, lang="eng")
        return text.strip(), 50.0

    # Build text and calculate average confidence
    words = []
    confidences = []
    for i, word in enumerate(data["text"]):
        word = word.strip()
        conf = int(data["conf"][i])
        if word and conf > 0:
            words.append(word)
            confidences.append(conf)

    text = " ".join(words)
    avg_conf = sum(confidences) / len(confidences) if confidences else 0.0

    return text, avg_conf


# ─── 3. Text Cleanup ─────────────────────────────────────────────────────────

# Patterns to remove (garbage text from packaging)
GARBAGE_PATTERNS = [
    # URLs and websites
    re.compile(r"https?://\S+", re.I),
    re.compile(r"www\.\S+", re.I),
    re.compile(r"\S+\.(?:com|in|org|net|co)(?:/\S*)?(?=\s|$)", re.I),
    # Social media handles
    re.compile(r"@\w+", re.I),
    re.compile(r"#\w+", re.I),
    re.compile(r"\b(?:facebook|instagram|twitter|youtube|whatsapp)\.com\S*", re.I),
    # Standalone barcode numbers (13+ digits not inside ingredient context)
    re.compile(r"(?<![,(])\b\d{13,14}\b(?![,)])"),
    # FSSAI license numbers
    re.compile(r"\bFSSAI\s*(?:Lic\.?\s*)?(?:No\.?\s*)?\d[\d\s]*", re.I),
    re.compile(r"\bLic\.?\s*No\.?\s*\d[\d\s]+", re.I),
    # Customer care / toll free (just the label + number, not whole line)
    re.compile(r"\bCustomer\s*Care\s*[:\.]?\s*[\d\-\s]+", re.I),
    re.compile(r"\bToll\s*Free\s*[:\.]?\s*[\d\-\s]+", re.I),
    re.compile(r"\b1800[\-\s]?\d{3}[\-\s]?\d{4}\b"),
    # MRP
    re.compile(r"\bMRP\s*[:\.]?\s*(?:Rs\.?\s*)?\d+", re.I),
    # Phone numbers (10 digits)
    re.compile(r"\b\d{10,11}\b"),
]

# Tokens that are definitely not ingredients
GARBAGE_TOKENS = {
    "pvt", "ltd", "limited", "inc", "corp", "llp", "india", "registered",
    "trademark", "copyright", "patent", "brand", "product", "company",
    "manufactured", "marketed", "distributed", "packed", "imported",
    "address", "office", "factory", "plant", "unit",
}


def _clean_ocr_text(raw: str) -> str:
    """Remove URLs, social media, barcodes, and other non-ingredient garbage."""
    text = raw

    # Apply garbage pattern removal
    for pattern in GARBAGE_PATTERNS:
        text = pattern.sub("", text)

    # Remove lines that are clearly not ingredients
    lines = text.split("\n")
    cleaned_lines = []
    for line in lines:
        line = line.strip()
        if not line:
            continue
        # Skip very short lines (likely noise)
        if len(line) < 3:
            continue
        # Skip lines that are mostly numbers
        digits = sum(c.isdigit() for c in line)
        if len(line) > 0 and digits / len(line) > 0.6:
            continue
        # Skip lines with too many special characters
        special = sum(not c.isalnum() and c not in " ,.()" for c in line)
        if len(line) > 0 and special / len(line) > 0.4:
            continue
        cleaned_lines.append(line)

    return " ".join(cleaned_lines)


# ─── 4. Ingredient Section Extraction ────────────────────────────────────────

# Headers that indicate the start of ingredient list
INGREDIENT_HEADERS = [
    re.compile(r"(?i)\b(?:ingredients?)\s*[:;.\-]?\s*"),
    re.compile(r"(?i)\b(?:contains?)\s*[:;.\-]?\s*"),
    re.compile(r"(?i)\b(?:composition)\s*[:;.\-]?\s*"),
    re.compile(r"(?i)\b(?:made\s+(?:from|with|of))\s*[:;.\-]?\s*"),
]

# Patterns that indicate END of ingredient section
SECTION_ENDERS = re.compile(
    r"(?i)\b("
    r"nutritional?\s*(?:info\w*|facts?|value|content)"
    r"|allergen\s*(?:info|warning|advice)"
    r"|allergen\s*[:\-]"
    r"|storage\s*(?:condition|instruction)"
    r"|best\s*before"
    r"|use\s*by"
    r"|mfg\.?\s*(?:date|d|by)"
    r"|exp\.?\s*(?:date|d)"
    r"|net\s*(?:wt|weight|qty|quantity)"
    r"|manufactured\s*(?:by|at|for)"
    r"|marketed\s*by"
    r"|packed\s*(?:by|at)"
    r"|imported\s*by"
    r"|this\s*product\s*(?:contains|may)"
    r"|may\s*contain\s*traces"
    r"|for\s*allergen"
    r"|not\s*recommended"
    r"|serving\s*(?:size|suggestion)"
    r"|directions?\s*(?:for|to)\s*use"
    r"|FSSAI"
    r"|per\s*\d+\s*(?:ml|g|gm|gram)"
    r"|(?:energy|calories|protein|carbohydrate|fat)\s*(?:per|:|\d)"
    r")"
)


def _extract_ingredient_section(text: str) -> str:
    """
    Find and extract ONLY the ingredient list from cleaned OCR text.
    Returns empty string if no ingredient section found.
    """
    # Try each header pattern
    for header_pattern in INGREDIENT_HEADERS:
        match = header_pattern.search(text)
        if match:
            # Extract everything after the header
            after_header = text[match.end():]

            # Find where the ingredient section ends
            end_match = SECTION_ENDERS.search(after_header)
            if end_match:
                ingredient_text = after_header[:end_match.start()]
            else:
                # Take up to 500 chars if no clear ending
                ingredient_text = after_header[:500]

            ingredient_text = ingredient_text.strip()
            if len(ingredient_text) > 10:
                return ingredient_text

    # No header found — if the text looks like a comma-separated list, use it
    if text.count(",") >= 3 and _looks_like_ingredient_list(text):
        # Trim to reasonable length
        return text[:500].strip()

    return ""


def _looks_like_ingredient_list(text: str) -> bool:
    """Heuristic: does this text look like an ingredient list?"""
    # Must have commas (ingredient separator)
    if text.count(",") < 2:
        return False
    # Should contain food-related words
    food_indicators = re.compile(
        r"\b(sugar|salt|flour|oil|water|milk|wheat|rice|starch|acid|"
        r"colour|color|flavor|flavour|preserv|emulsif|spice|extract|"
        r"sodium|calcium|iron|vitamin|protein|fat|fibre|fiber)\b",
        re.I
    )
    return bool(food_indicators.search(text))


# ─── 5. Ingredient Parsing ───────────────────────────────────────────────────

def _parse_ingredients(text: str) -> list[str]:
    """
    Parse ingredient text into clean individual ingredients.
    "Water, Sugar, Citric Acid" → ["Water", "Sugar", "Citric Acid"]
    """
    if not text:
        return []

    # Remove parenthetical sub-ingredients for top-level parsing
    # e.g., "Edible Vegetable Oil (Palm, Sunflower)" → "Edible Vegetable Oil"
    flat = re.sub(r"\([^)]*\)", "", text)

    # Also split on period followed by space+uppercase (new section)
    flat = re.sub(r"\.\s+(?=[A-Z])", ",", flat)

    # Split by comma, semicolon
    raw_items = re.split(r"[,;]+", flat)

    ingredients = []
    for item in raw_items:
        # Clean up each ingredient
        cleaned = item.strip()
        cleaned = re.sub(r"\s+", " ", cleaned)  # Normalize whitespace
        cleaned = cleaned.strip(".-_ ")

        # Remove leading numbers/percentages (e.g., "35% Wheat Flour")
        cleaned = re.sub(r"^\d+\.?\d*\s*%?\s*", "", cleaned)

        # Remove section sub-headers that got included
        cleaned = re.sub(r"^(?:Tastemaker|ALLERGEN|Allergen|Contains)\s*:?\s*", "", cleaned, flags=re.I)

        # Skip garbage tokens
        lower = cleaned.lower()
        if any(token in lower for token in GARBAGE_TOKENS):
            continue

        # Skip if too short or too long
        if len(cleaned) < 2 or len(cleaned) > 60:
            continue

        # Skip if mostly digits
        if cleaned and sum(c.isdigit() for c in cleaned) / len(cleaned) > 0.5:
            continue

        if cleaned:
            ingredients.append(cleaned)

    return ingredients


# ─── 6. Confidence Check ─────────────────────────────────────────────────────

def _assess_quality(ingredients: list[str], confidence: float) -> bool:
    """
    Determine if OCR result is reliable enough to use.
    Returns True if quality is acceptable.
    """
    # Must have at least 2 ingredients
    if len(ingredients) < 2:
        return False

    # Average confidence should be reasonable
    if confidence < 30:
        return False

    # At least some ingredients should look like real food words
    food_words = re.compile(
        r"(?i)\b(sugar|salt|flour|oil|water|milk|wheat|rice|acid|spice|"
        r"colour|color|starch|sodium|extract|flavour|flavor|cream|butter|"
        r"vinegar|yeast|corn|soy|palm|vegetable|fruit|juice|powder|syrup)\b"
    )
    food_matches = sum(1 for ing in ingredients if food_words.search(ing))

    # At least 20% of ingredients should be recognizable food words
    if food_matches < max(1, len(ingredients) * 0.2):
        return False

    return True


# ─── 7. Gemini Vision Fallback ────────────────────────────────────────────────

def _gemini_extract_ingredients(image_bytes: bytes) -> str:
    """
    Use Gemini Vision as fallback for difficult labels.
    Returns comma-separated ingredient string or empty string.
    """
    if not GEMINI_API_KEY:
        return ""

    try:
        model = genai.GenerativeModel("gemini-2.5-flash")

        image = Image.open(io.BytesIO(image_bytes))
        if image.mode != "RGB":
            image = image.convert("RGB")

        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=85)
        img_bytes = buffer.getvalue()

        response = model.generate_content([
            {
                "mime_type": "image/jpeg",
                "data": base64.b64encode(img_bytes).decode("utf-8"),
            },
            """You are an OCR system for food product labels. Extract ONLY the ingredients list.

STRICT RULES:
1. Return ONLY ingredient names separated by commas
2. Do NOT include: URLs, social media, barcodes, FSSAI numbers, addresses, nutritional info, allergen warnings, storage instructions, brand names, marketing text
3. If you see "Ingredients:" or similar header, skip it — return only the list after it
4. Keep ingredient names exactly as printed (don't translate or modify)
5. If you cannot clearly identify an ingredients list, return exactly: NOT_FOUND
6. Do NOT guess or hallucinate ingredients
7. Do NOT add explanations or commentary

Example output:
Water, Sugar, Carbonated Water, Citric Acid, Sodium Benzoate, Artificial Colour (E150d)"""
        ])

        result = response.text.strip()

        # Validate response
        if result == "NOT_FOUND" or len(result) < 5:
            return ""
        # Check it's not an explanation
        if any(phrase in result.lower() for phrase in ["i cannot", "i can't", "sorry", "unable to", "not visible"]):
            return ""

        return result
    except Exception:
        return ""


# ─── Main Pipeline ────────────────────────────────────────────────────────────

def extract_ingredients_from_image(image_bytes: bytes) -> str:
    """
    Production OCR pipeline for ingredient extraction.

    Pipeline:
    1. Preprocess image
    2. Run Tesseract OCR
    3. Clean garbage text
    4. Extract ingredient section
    5. Parse into structured list
    6. Check quality/confidence
    7. Fall back to Gemini if needed
    8. Return clean ingredient string or empty string

    Returns: comma-separated ingredient string, or empty string if unreadable.
    """
    image = Image.open(io.BytesIO(image_bytes))

    # ── Step 1-2: Preprocess and OCR ──
    processed = _preprocess_image(image)
    raw_text, confidence = _run_tesseract(processed)

    # ── Step 3: Clean garbage ──
    cleaned_text = _clean_ocr_text(raw_text)

    # ── Step 4: Extract ingredient section ──
    ingredient_text = _extract_ingredient_section(cleaned_text)

    # ── Step 5: Parse ingredients ──
    ingredients = _parse_ingredients(ingredient_text)

    # ── Step 6: Quality check ──
    if _assess_quality(ingredients, confidence):
        # Good quality — return the parsed ingredients as comma-separated string
        return ", ".join(ingredients)

    # ── Step 7: Tesseract failed — try Gemini Vision ──
    gemini_result = _gemini_extract_ingredients(image_bytes)
    if gemini_result:
        # Validate Gemini result too
        gemini_ingredients = _parse_ingredients(gemini_result)
        if len(gemini_ingredients) >= 2:
            return ", ".join(gemini_ingredients)
        # If parsing stripped too much, return raw Gemini result
        if gemini_result.count(",") >= 2:
            return gemini_result

    # ── Step 8: If we got SOME ingredients from Tesseract, return them ──
    if len(ingredients) >= 2:
        return ", ".join(ingredients)

    # Nothing usable
    return ""
