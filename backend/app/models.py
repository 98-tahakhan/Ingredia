"""
Pydantic models for request/response schemas.
"""

from pydantic import BaseModel
from typing import Literal, Optional


# ─── Ingredient Analysis ──────────────────────────────────────────────────────

class ClassifiedIngredient(BaseModel):
    name: str
    risk: Literal["green", "yellow", "red"]
    note: str


class HealthNote(BaseModel):
    title: str
    body: str


class HealthAnalysis(BaseModel):
    score: int
    ingredients: list[ClassifiedIngredient]
    notes: list[HealthNote]


# ─── Product ─────────────────────────────────────────────────────────────────

class ProductData(BaseModel):
    barcode: str
    name: str
    brand: str
    image: str
    category: str
    ingredientsText: str
    analysis: HealthAnalysis


class AlternativeProduct(BaseModel):
    barcode: str
    name: str
    brand: str
    image: str
    health_score: int


# ─── API Requests ─────────────────────────────────────────────────────────────

class BarcodeRequest(BaseModel):
    barcode: str


class AIRequest(BaseModel):
    product_name: str
    brand: str
    ingredients_text: str
    score: int
    question: Optional[str] = None


class AnalyzeRequest(BaseModel):
    ingredients_text: str


# ─── API Responses ────────────────────────────────────────────────────────────

class ProductResponse(BaseModel):
    found: bool
    product: Optional[ProductData] = None
    alternatives: list[AlternativeProduct] = []


class OCRResponse(BaseModel):
    success: bool
    extracted_text: str
    analysis: Optional[HealthAnalysis] = None


class AIResponse(BaseModel):
    answer: str


class ErrorResponse(BaseModel):
    detail: str
