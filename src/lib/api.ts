/**
 * Ingredia API client.
 * 
 * Architecture: Frontend ONLY calls the backend API.
 * All business logic (Open Food Facts, health scoring, OCR, AI) lives in the backend.
 * Gemini API key is NEVER exposed here.
 */

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ClassifiedIngredient {
    name: string;
    risk: "green" | "yellow" | "red";
    note: string;
}

export interface HealthNote {
    title: string;
    body: string;
}

export interface HealthAnalysis {
    score: number;
    ingredients: ClassifiedIngredient[];
    notes: HealthNote[];
}

export interface ProductData {
    barcode: string;
    name: string;
    brand: string;
    image: string;
    category: string;
    ingredientsText: string;
    analysis: HealthAnalysis;
}

export interface AlternativeProduct {
    barcode: string;
    name: string;
    brand: string;
    image: string;
    health_score: number;
}

export interface ScanResult {
    found: boolean;
    product: ProductData | null;
    alternatives: AlternativeProduct[];
}

// ─── API Functions ───────────────────────────────────────────────────────────

/**
 * Scan a barcode — backend fetches from Open Food Facts + analyzes + returns alternatives.
 */
export async function scanBarcode(barcode: string): Promise<ScanResult> {
    const res = await fetch(`${API_BASE}/api/scan/barcode`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ barcode }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Network error" }));
        throw new Error(err.detail || `API error: ${res.status}`);
    }

    return res.json();
}

/**
 * OCR scan — upload ingredient label image to backend.
 */
export async function scanIngredientImage(file: File): Promise<{
    success: boolean;
    extracted_text: string;
    analysis: HealthAnalysis | null;
}> {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch(`${API_BASE}/api/scan/ingredients`, {
        method: "POST",
        body: formData,
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "OCR failed" }));
        throw new Error(err.detail || "OCR scan failed");
    }

    return res.json();
}

/**
 * Ask AI about a product (Gemini call happens backend-side only).
 */
export async function askAI(params: {
    product_name: string;
    brand: string;
    ingredients_text: string;
    score: number;
    question?: string;
}): Promise<string> {
    const res = await fetch(`${API_BASE}/api/ai/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "AI unavailable" }));
        throw new Error(err.detail || "AI request failed");
    }

    const data = await res.json();
    return data.answer;
}

/**
 * Analyze raw ingredient text (for manual input or edited OCR).
 */
export async function analyzeIngredients(ingredientsText: string): Promise<HealthAnalysis> {
    const res = await fetch(`${API_BASE}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ingredients_text: ingredientsText }),
    });

    if (!res.ok) {
        throw new Error("Analysis failed");
    }

    return res.json();
}
