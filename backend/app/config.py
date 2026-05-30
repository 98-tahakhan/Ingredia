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

# Tesseract OCR path (Windows default)
TESSERACT_CMD: str = os.getenv(
    "TESSERACT_CMD",
    r"C:\Program Files\Tesseract-OCR\tesseract.exe"
)
