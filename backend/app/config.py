"""
Application configuration — loads from environment variables.
"""

import os
from dotenv import load_dotenv

load_dotenv()

# Gemini API (backend-only, NEVER exposed to frontend)
GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

# Supabase
SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_JWT_SECRET: str = os.getenv("SUPABASE_JWT_SECRET", "")

# Frontend URL for CORS
FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:8080")

# Open Food Facts
OPENFOODFACTS_BASE_URL: str = os.getenv(
    "OPENFOODFACTS_BASE_URL",
    "https://world.openfoodfacts.org/api/v2/product"
)

# OCR.Space API key (cloud OCR — no local Tesseract needed)
OCR_SPACE_API_KEY: str = os.getenv("OCR_SPACE_API_KEY", "")
