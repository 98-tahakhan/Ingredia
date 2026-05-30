"""
Deterministic ingredient classification and health scoring engine.
This is the SINGLE source of truth for ingredient analysis.
All scoring happens server-side only.
"""

import re
from .models import ClassifiedIngredient, HealthAnalysis, HealthNote

# ─── Classification Rules (ordered: RED → YELLOW → GREEN) ────────────────────

RULES: list[tuple[re.Pattern, str, str]] = [
    # RED — ultra-processed / additives of concern
    (re.compile(r"\b(palm\s*oil|palmolein|hydrogenated|vanaspati|trans\s*fat)\b", re.I),
     "red", "Saturated/trans fats — limit intake"),
    (re.compile(r"\b(monosodium\s*glutamate|msg|e\s*621|e\s*627|e\s*631|e\s*635)\b", re.I),
     "red", "Flavour enhancer linked to overconsumption"),
    (re.compile(r"\b(sodium\s*benzoate|e\s*211|potassium\s*sorbate|e\s*202|sodium\s*nitrite|e\s*250|sulphur\s*dioxide|e\s*220)\b", re.I),
     "red", "Synthetic preservative — limit frequent intake"),
    (re.compile(r"\b(allura\s*red|tartrazine|sunset\s*yellow|e\s*129|e\s*102|e\s*110|e\s*124|e\s*133|brilliant\s*blue)\b", re.I),
     "red", "Artificial colour — restricted in some regions"),
    (re.compile(r"\b(high\s*fructose\s*corn\s*syrup|hfcs|invert\s*syrup|glucose\s*syrup|liquid\s*sugar)\b", re.I),
     "red", "Concentrated added sugar"),
    (re.compile(r"\b(aspartame|sucralose|acesulfame|saccharin|e\s*951|e\s*955|e\s*950)\b", re.I),
     "red", "Artificial sweetener — moderate intake"),
    (re.compile(r"\b(maida|refined\s*wheat\s*flour|refined\s*flour)\b", re.I),
     "red", "Refined flour — stripped of fibre"),
    (re.compile(r"\b(sugar|sucrose|dextrose|fructose)\b", re.I),
     "red", "Added sugar"),

    # YELLOW — moderate concern
    (re.compile(r"\b(salt|iodised\s*salt|sodium\s*chloride)\b", re.I),
     "yellow", "Watch sodium content"),
    (re.compile(r"\b(refined\s*oil|sunflower\s*oil|soybean\s*oil|cottonseed\s*oil|rice\s*bran\s*oil|edible\s*vegetable\s*oil)\b", re.I),
     "yellow", "Refined oil — high omega-6"),
    (re.compile(r"\b(citric\s*acid|e\s*330|acidity\s*regulator|phosphoric\s*acid|e\s*338)\b", re.I),
     "yellow", "Acidity regulator — generally tolerated"),
    (re.compile(r"\b(caffeine)\b", re.I),
     "yellow", "Stimulant — limit daily intake"),
    (re.compile(r"\b(emulsifier|stabili[sz]er|thickener|e\s*4\d{2}|e\s*5\d{2})\b", re.I),
     "yellow", "Processing additive"),
    (re.compile(r"\b(natural\s*identical|artificial\s*flavou?r|flavou?ring)\b", re.I),
     "yellow", "Added flavouring"),
    (re.compile(r"\b(maltodextrin|modified\s*starch)\b", re.I),
     "yellow", "Processed carbohydrate"),
    (re.compile(r"\b(milk\s*solids|skimmed\s*milk\s*powder|whey\s*powder)\b", re.I),
     "yellow", "Processed dairy"),
    (re.compile(r"\b(honey|jaggery)\b", re.I),
     "yellow", "Natural sweetener — still sugar"),

    # GREEN — whole / safe
    (re.compile(r"\b(whole\s*wheat|atta|oats|ragi|jowar|bajra|millet|brown\s*rice|quinoa|barley)\b", re.I),
     "green", "Whole grain"),
    (re.compile(r"\b(olive\s*oil|cold\s*pressed|ghee|coconut\s*oil)\b", re.I),
     "green", "Traditional fat — use in moderation"),
    (re.compile(r"\b(turmeric|cumin|coriander|pepper|cardamom|cinnamon|clove|ginger|garlic|spice|chilli)\b", re.I),
     "green", "Natural spice"),
    (re.compile(r"\b(potato|tomato|onion|carrot|peas|spinach|vegetable)\b", re.I),
     "green", "Whole vegetable"),
    (re.compile(r"\b(makhana|fox\s*nut|almond|cashew|peanut|nuts?|seeds?)\b", re.I),
     "green", "Whole food"),
    (re.compile(r"\b(water|aqua)\b", re.I),
     "green", "Base ingredient"),
    (re.compile(r"\b(yeast|baking\s*soda|raising\s*agent|sodium\s*bicarbonate)\b", re.I),
     "green", "Standard leavening"),
    (re.compile(r"\b(milk|curd|yogurt|paneer|cream)\b", re.I),
     "green", "Dairy"),
]


def _prettify(s: str) -> str:
    """Capitalize ingredient name nicely."""
    trimmed = s.strip().strip("_").strip()
    if not trimmed:
        return s
    words = trimmed.split()
    return " ".join(
        w[0].upper() + w[1:].lower() if len(w) > 2 else w.lower()
        for w in words
    )


def classify_ingredient(raw: str) -> ClassifiedIngredient:
    """Classify a single ingredient by risk level. Deterministic — same input always gives same output."""
    name = re.sub(r"\s+", " ", raw.strip()).strip("()")
    for pattern, risk, note in RULES:
        if pattern.search(name):
            return ClassifiedIngredient(name=_prettify(name), risk=risk, note=note)
    return ClassifiedIngredient(name=_prettify(name), risk="yellow", note="Unclassified — assess in context")


def parse_ingredient_list(text: str) -> list[str]:
    """Parse raw ingredient text into individual ingredient strings."""
    if not text:
        return []
    # Strip parenthetical sub-ingredients for top-level list
    flat = re.sub(r"\([^)]*\)", "", text)
    items = re.split(r"[,;.]+", flat)
    return [s.strip() for s in items if 1 < len(s.strip()) < 80]


def analyze(ingredients_text: str) -> HealthAnalysis:
    """
    Analyze ingredient text and produce a deterministic health score.
    
    Scoring logic:
    - Start at 100
    - Each RED ingredient: -12
    - Each YELLOW ingredient: -4
    - Each GREEN ingredient: +2
    - Long ingredient list (>10 items): -2 per extra item (ultra-processed proxy)
    - Clamped to [5, 100]
    """
    items = [classify_ingredient(raw) for raw in parse_ingredient_list(ingredients_text)]
    counts = {"green": 0, "yellow": 0, "red": 0}
    for item in items:
        counts[item.risk] += 1

    # Deterministic scoring
    score = 100
    score -= counts["red"] * 12
    score -= counts["yellow"] * 4
    score += counts["green"] * 2
    if len(items) > 10:
        score -= (len(items) - 10) * 2
    score = max(5, min(100, round(score)))

    # Generate health notes based on detected patterns
    notes: list[HealthNote] = []
    if counts["red"] >= 3:
        notes.append(HealthNote(
            title="Ultra-processed",
            body="Multiple high-concern additives or refined ingredients detected. Best consumed occasionally."
        ))
    if re.search(r"\b(palm\s*oil|palmolein)\b", ingredients_text, re.I):
        notes.append(HealthNote(
            title="Contains Palm Oil",
            body="High in saturated fat and linked to environmental concerns."
        ))
    if re.search(r"\b(sugar|sucrose|hfcs|invert\s*syrup|glucose\s*syrup)\b", ingredients_text, re.I):
        notes.append(HealthNote(
            title="Added Sugar",
            body="Frequent intake raises risk of metabolic issues."
        ))
    if re.search(r"\b(maida|refined\s*wheat\s*flour)\b", ingredients_text, re.I):
        notes.append(HealthNote(
            title="Refined Carbs",
            body="Maida spikes blood sugar quickly — pair with fibre/protein."
        ))
    if counts["green"] >= 4 and counts["red"] == 0:
        notes.append(HealthNote(
            title="Clean Label",
            body="Mostly recognisable whole-food ingredients."
        ))

    return HealthAnalysis(score=score, ingredients=items, notes=notes)
