"""
Ingredia Backend — FastAPI server.

Architecture:
- Backend handles ALL business logic: barcode lookup, Open Food Facts, health scoring, OCR, AI
- Frontend only handles: scanning, UI rendering, auth state, API calls
- Gemini API key is backend-only (never exposed to frontend)
- Protected endpoints require Supabase JWT
"""

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware

from .models import (
    BarcodeRequest,
    ProductResponse,
    OCRResponse,
    AIRequest,
    AIResponse,
    AnalyzeRequest,
)
from .product_service import fetch_product_by_barcode, fetch_alternatives
from .health_engine import analyze
from .ocr_service import extract_ingredients_from_image
from .ai_service import ask_about_product
from .auth import get_current_user_id

app = FastAPI(
    title="Ingredia API",
    description="Backend API for Ingredia — packaged food ingredient analysis",
    version="1.0.0",
)

# ─── CORS Configuration ──────────────────────────────────────────────────────
# Allow frontend origins (dev + production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Health Check ─────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"status": "ok", "service": "Ingredia API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


# ─── Product Lookup (Public) ──────────────────────────────────────────────────

@app.post("/api/scan/barcode", response_model=ProductResponse)
async def scan_barcode(req: BarcodeRequest):
    """
    Look up a product by barcode.
    Flow: barcode → Open Food Facts → ingredient analysis → health score → response
    """
    barcode = req.barcode.strip()
    if not barcode:
        raise HTTPException(status_code=400, detail="Barcode is required")
    if not barcode.isdigit() or len(barcode) not in (8, 12, 13):
        raise HTTPException(status_code=400, detail="Invalid barcode format. Must be 8, 12, or 13 digits (UPC/EAN)")

    product = await fetch_product_by_barcode(barcode)

    if not product:
        return ProductResponse(found=False, product=None, alternatives=[])

    # Fetch alternatives alongside the product
    alternatives = await fetch_alternatives(product.category, product.name, barcode)

    return ProductResponse(found=True, product=product, alternatives=alternatives)


# ─── OCR Scan (Public) ────────────────────────────────────────────────────────

@app.post("/api/scan/ingredients", response_model=OCRResponse)
async def scan_ingredients(file: UploadFile = File(...)):
    """
    Extract ingredients from an uploaded image using OCR.Space cloud API, then analyze.
    Falls back to Gemini Vision for difficult Indian labels.
    """
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image (JPEG, PNG, etc.)")

    image_bytes = await file.read()
    if len(image_bytes) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 5MB). Please compress before uploading.")
    if len(image_bytes) < 1000:
        raise HTTPException(status_code=400, detail="Image too small or empty")

    try:
        ingredient_text = await extract_ingredients_from_image(image_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR processing failed: {str(e)}")

    if not ingredient_text:
        return OCRResponse(
            success=False,
            extracted_text="Could not reliably read ingredients. Please upload a clearer image with the ingredient list visible.",
            analysis=None
        )

    # Analyze extracted ingredients
    analysis = analyze(ingredient_text)
    return OCRResponse(success=True, extracted_text=ingredient_text, analysis=analysis)


# ─── Analyze Raw Text (Public) ────────────────────────────────────────────────

@app.post("/api/analyze")
async def analyze_text(req: AnalyzeRequest):
    """Analyze raw ingredient text (useful after OCR editing or manual input)."""
    if not req.ingredients_text.strip():
        raise HTTPException(status_code=400, detail="ingredients_text is required")

    analysis = analyze(req.ingredients_text)
    return analysis.model_dump()


# ─── AI Feature (Public — rate limited by Gemini) ─────────────────────────────

@app.post("/api/ai/ask", response_model=AIResponse)
async def ask_ai(req: AIRequest):
    """
    Ask AI about a product's ingredients.
    Gemini API key is backend-only — frontend never sees it.
    """
    if not req.ingredients_text.strip():
        raise HTTPException(status_code=400, detail="ingredients_text is required")

    answer = await ask_about_product(
        product_name=req.product_name,
        brand=req.brand,
        ingredients_text=req.ingredients_text,
        score=req.score,
        question=req.question,
    )
    return AIResponse(answer=answer)


# ─── Protected Endpoints (Require Supabase JWT) ──────────────────────────────

@app.get("/api/history")
async def get_history(user_id: str = Depends(get_current_user_id)):
    """Get scan history for authenticated user. (Handled by Supabase RLS on frontend)"""
    # Note: History is managed directly via Supabase from frontend using RLS.
    # This endpoint exists for future server-side history if needed.
    return {"user_id": user_id, "message": "History is managed via Supabase RLS"}


@app.get("/api/saved")
async def get_saved(user_id: str = Depends(get_current_user_id)):
    """Get saved alternatives for authenticated user."""
    return {"user_id": user_id, "message": "Saved items managed via Supabase RLS"}


# ─── Error Handlers ──────────────────────────────────────────────────────────

@app.exception_handler(404)
async def not_found_handler(request, exc):
    return {"detail": "Endpoint not found"}


@app.exception_handler(500)
async def server_error_handler(request, exc):
    return {"detail": "Internal server error. Please try again."}
