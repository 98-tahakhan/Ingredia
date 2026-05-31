"""
Production OCR pipeline for ingredient extraction from food labels.

Pipeline:
1. Send image to OCR.Space cloud API (no local Tesseract needed)
2. Text cleanup (remove URLs, social media, barcodes, garbage)
3. Ingredient section extraction (find "Ingredients:" header)
4. Structured parsing into ingredient array
5. Confidence check — reject low-quality results
6. Gemini Vision fallback for difficult labels

Does NOT hallucinate ingredients. Returns error if text is unreadable.
"""

import io
import re
import base64
import httpx
from PIL import Image
import google.generativeai as genai
from .config import GEMINI_API_KEY, OCR_SPACE_API_KEY

# ─── Configuration ────────────────────────────────────────────────────────────

OCR_SPACE_URL = "https://api.ocr.space/parse/image"

if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)


# ─── 1. OCR.Space Cloud OCR ──────────────────────────────────────────────────

async def _run_ocr_space(image_bytes: bytes) -> tuple[str, float]:
    """
    Send image to OCR.Space API for text extraction.
    Returns (extracted_text, confidence_score).

    Handles:
    - API failures (network, timeout)
    - Rate limiting (HTTP 429)
    - Unreadable images (empty result)
    """
    if not OCR_SPACE_API_KEY:
        return "", 0.0

    # Encode image as base64 data URI for OCR.Space
    img_base64 = base64.b64encode(image_bytes).decode("utf-8")
    # Detect format from bytes header
    if image_bytes[:3] == b"\xff\xd8\xff":
        mime = "image/jpeg"
    elif image_bytes[:8] == b"\x89PNG\r\n\x1a\n":
        mime = "image/png"
    else:
        mime = "image/jpeg"  # Default to JPEG

    payload = {
        "apikey": OCR_SPACE_API_KEY,
        "base64Image": f"data:{mime};base64,{img_base64}",
        "language": "eng",
        "isOverlayRequired": "false",
        "detectOrientation": "true",
        "scale": "true",
        "OCREngine": "2",  # Engine 2 is better for dense text / labels
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(OCR_SPACE_URL, data=payload)

        # Handle rate limiting
        if response.status_code == 429:
            return "", 0.0

        if response.status_code != 200:
            return "", 0.0

        result = response.json()

        # Check for API-level errors
        if result.get("IsErroredOnProcessing", False):
            return "", 0.0

        if result.get("OCRExitCode", 0) != 1:
            # Exit code 1 = success, others indicate issues
            return "", 0.0

        # Extract text from parsed results
        parsed_results = result.get("ParsedResults", [])
        if not parsed_results:
            return "", 0.0

        text_parts = []
        total_confidence = 0.0
        count = 0

        for parsed in parsed_results:
            text = parsed.get("ParsedText", "").strip()
            if text:
                text_parts.append(text)
            # OCR.Space doesn't give per-word confidence in basic mode,
            # but we can use the exit code and text length as proxy
            if text:
                count += 1
                # Estimate confidence based on text quality indicators
                total_confidence += 70.0  # Base confidence for successful parse

        full_text = "\n".join(text_parts)

        # Adjust confidence based on text characteristics
        avg_confidence = (total_confidence / count) if count > 0 else 0.0
        if len(full_text) > 50:
            avg_confidence += 10.0  # Bonus for substantial text
        if full_text.count(",") >= 3:
            avg_confidence += 10.0  # Bonus for comma-separated content (likely ingredients)

        return full_text, min(avg_confidence, 95.0)

    except httpx.TimeoutException:
        return "", 0.0
    except httpx.RequestError:
        return "", 0.0
    except (ValueError, KeyError):
        return "", 0.0


# ─── 2. Text Cleanup ─────────────────────────────────────────────────────────

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


# ─── 3. Ingredient Section Extraction ────────────────────────────────────────

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


# ─── 4. Ingredient Parsing ───────────────────────────────────────────────────

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


# ─── 5. Confidence Check ─────────────────────────────────────────────────────

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


# ─── 6. Gemini Vision Fallback ────────────────────────────────────────────────

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

async def extract_ingredients_from_image(image_bytes: bytes) -> str:
    """
    Production OCR pipeline for ingredient extraction.

    Pipeline:
    1. Send image to OCR.Space cloud API
    2. Clean garbage text
    3. Extract ingredient section
    4. Parse into structured list
    5. Check quality/confidence
    6. Fall back to Gemini if needed
    7. Return clean ingredient string or empty string

    Returns: comma-separated ingredient string, or empty string if unreadable.
    """
    # ── Step 1: Cloud OCR via OCR.Space ──
    raw_text, confidence = await _run_ocr_space(image_bytes)

    # ── Step 2: Clean garbage ──
    cleaned_text = _clean_ocr_text(raw_text) if raw_text else ""

    # ── Step 3: Extract ingredient section ──
    ingredient_text = _extract_ingredient_section(cleaned_text) if cleaned_text else ""

    # ── Step 4: Parse ingredients ──
    ingredients = _parse_ingredients(ingredient_text)

    # ── Step 5: Quality check ──
    if _assess_quality(ingredients, confidence):
        # Good quality — return the parsed ingredients as comma-separated string
        return ", ".join(ingredients)

    # ── Step 6: OCR.Space failed or low quality — try Gemini Vision ──
    gemini_result = _gemini_extract_ingredients(image_bytes)
    if gemini_result:
        # Validate Gemini result too
        gemini_ingredients = _parse_ingredients(gemini_result)
        if len(gemini_ingredients) >= 2:
            return ", ".join(gemini_ingredients)
        # If parsing stripped too much, return raw Gemini result
        if gemini_result.count(",") >= 2:
            return gemini_result

    # ── Step 7: If we got SOME ingredients from OCR.Space, return them ──
    if len(ingredients) >= 2:
        return ", ".join(ingredients)

    # Nothing usable
    return ""
