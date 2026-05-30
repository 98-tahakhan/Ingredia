"""
AI service using Google Gemini for ingredient education and health guidance.

Purpose (Gemini is used ONLY for):
- Ingredient explanations ("What is sodium benzoate?")
- Health interpretation ("Is this safe for daily use?")
- Safer alternatives ("What can I eat instead?")
- Educational guidance ("Why is palm oil concerning?")

Gemini does NOT:
- Replace the deterministic health scoring engine
- Make medical diagnoses
- Prescribe dietary changes

API key is BACKEND-ONLY — never exposed to frontend.
"""

import logging
import google.generativeai as genai
from .config import GEMINI_API_KEY

logger = logging.getLogger(__name__)

# Configure Gemini (backend-only)
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    logger.info("Gemini API configured successfully")
else:
    logger.warning("GEMINI_API_KEY not set — AI features disabled")

# Models to try in order (fallback chain)
MODEL_CHAIN = [
    "gemini-2.5-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.0-flash",
]

SYSTEM_PROMPT = """You are a food ingredient educator helping Indian consumers understand packaged food products.

YOUR ROLE:
- Explain what ingredients are and why they matter
- Provide health context (not medical advice)
- Suggest healthier alternatives when asked
- Use simple language a regular consumer understands

STRICT RULES:
1. NEVER make medical diagnoses or prescribe treatments
2. NEVER say "you should stop eating this" — instead say "frequent consumption may..."
3. Always add a disclaimer like "consult a nutritionist for personalized advice" when giving health guidance
4. Keep responses under 200 words
5. Use plain text only — no markdown, no bullet points with *, no headers with #
6. Focus on Indian consumer context (local brands, FSSAI standards, Indian dietary patterns)
7. Be factual and cite general scientific consensus, not fringe claims
8. If unsure about something, say so honestly

TONE: Friendly, educational, non-alarmist. Like a knowledgeable friend explaining food labels."""


async def ask_about_product(
    product_name: str,
    brand: str,
    ingredients_text: str,
    score: int,
    question: str | None = None,
) -> str:
    """
    Ask Gemini about a product's ingredients and health impact.
    Tries multiple models in case of quota exhaustion.
    Returns educational guidance, NOT medical advice.
    """
    if not GEMINI_API_KEY:
        logger.error("GEMINI_API_KEY is not set")
        return "AI feature is not configured. Set GEMINI_API_KEY in the backend .env file."

    default_question = (
        "Briefly explain the key ingredients in this product. "
        "Which ones should I be aware of and why? "
        "Is this okay for occasional consumption?"
    )

    user_prompt = f"""Product: {product_name}
Brand: {brand}
Health Score: {score}/100
Ingredients: {ingredients_text}

Question: {question or default_question}"""

    last_error = None

    for model_name in MODEL_CHAIN:
        try:
            logger.info(f"Trying Gemini model: {model_name}")
            model = genai.GenerativeModel(
                model_name,
                system_instruction=SYSTEM_PROMPT,
            )
            response = model.generate_content(user_prompt)
            logger.info(f"Gemini response received from {model_name}")
            return response.text.strip()

        except Exception as e:
            error_msg = str(e)
            last_error = error_msg
            logger.warning(f"Model {model_name} failed: {error_msg[:150]}")

            # If it's a quota error, try next model
            if "429" in error_msg or "quota" in error_msg.lower() or "ResourceExhausted" in type(e).__name__:
                continue
            # For other errors (auth, invalid key), don't retry
            else:
                break

    # All models failed
    error_detail = last_error[:200] if last_error else "Unknown error"
    logger.error(f"All Gemini models failed. Last error: {error_detail}")

    # Return informative error in development
    if "429" in (last_error or "") or "quota" in (last_error or "").lower():
        return (
            "Gemini API free tier quota exhausted. "
            "The quota resets daily. Please try again tomorrow, or upgrade to a paid plan at https://aistudio.google.com."
        )

    return f"AI analysis failed: {error_detail}"
