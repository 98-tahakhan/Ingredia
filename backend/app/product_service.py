"""
Product lookup service — Open Food Facts integration.
All Open Food Facts calls happen HERE (backend only), never from frontend.
"""

import re
import httpx
from .config import OPENFOODFACTS_BASE_URL
from .health_engine import analyze
from .models import ProductData, AlternativeProduct

# Curated safer Indian alternative product barcodes by category
ALT_MAP: list[tuple[re.Pattern, list[str]]] = [
    (re.compile(r"chip|crisp|snack|namkeen|kurkure", re.I), ["8908004700014", "8904245200017"]),
    (re.compile(r"cola|soda|soft\s*drink|beverage|pepsi|coke|fanta|sprite|thums|mountain\s*dew", re.I), ["8901030865842", "8901058000122"]),
    (re.compile(r"noodle|maggi", re.I), ["8904109485712"]),
    (re.compile(r"biscuit|cookie|parle", re.I), ["8901063152199", "8901063012349"]),
    (re.compile(r"chocolate|candy", re.I), ["8901058000122"]),
]


async def fetch_product_by_barcode(barcode: str) -> ProductData | None:
    """
    Fetch product from Open Food Facts API and run health analysis.
    Returns None if product not found or API error.
    """
    url = (
        f"{OPENFOODFACTS_BASE_URL}/{barcode}.json"
        f"?fields=product_name,brands,image_front_url,image_url,categories,"
        f"ingredients_text,ingredients_text_en"
    )

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.get(url)
            if resp.status_code != 200:
                return None
            data = resp.json()
        except (httpx.RequestError, httpx.TimeoutException, ValueError):
            return None

    if data.get("status") != 1 or not data.get("product"):
        return None

    p = data["product"]
    ingredients_text: str = p.get("ingredients_text_en") or p.get("ingredients_text") or ""
    product_name: str = p.get("product_name") or ""

    if not product_name and not ingredients_text:
        return None

    # Run deterministic health analysis
    analysis = analyze(ingredients_text)

    brands_raw = p.get("brands") or ""
    brand = brands_raw.split(",")[0].strip() or "Unknown"
    categories_raw = p.get("categories") or ""
    category_parts = categories_raw.split(",")
    category = category_parts[-1].strip() if category_parts else "Packaged food"

    return ProductData(
        barcode=barcode,
        name=product_name or "Unknown product",
        brand=brand,
        image=p.get("image_front_url") or p.get("image_url") or "",
        category=category,
        ingredientsText=ingredients_text,
        analysis=analysis,
    )


def _get_alternative_barcodes(category: str, name: str) -> list[str]:
    """Get curated alternative product barcodes based on category/name."""
    hay = f"{category} {name}"
    for pattern, barcodes in ALT_MAP:
        if pattern.search(hay):
            return barcodes
    return []


async def fetch_alternatives(category: str, name: str, exclude_barcode: str) -> list[AlternativeProduct]:
    """Fetch healthier alternative products."""
    alt_barcodes = _get_alternative_barcodes(category, name)
    alternatives: list[AlternativeProduct] = []

    for bc in alt_barcodes:
        if bc == exclude_barcode:
            continue
        product = await fetch_product_by_barcode(bc)
        if product:
            alternatives.append(AlternativeProduct(
                barcode=product.barcode,
                name=product.name,
                brand=product.brand,
                image=product.image,
                health_score=product.analysis.score,
            ))

    return alternatives
