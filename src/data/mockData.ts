import biscuits from "@/assets/cat-biscuits.jpg";
import snacks from "@/assets/cat-snacks.jpg";
import drinks from "@/assets/cat-drinks.jpg";
import noodles from "@/assets/cat-noodles.jpg";
import chocolates from "@/assets/cat-chocolates.jpg";

export const categoryImages = { biscuits, snacks, drinks, noodles, chocolates };

export type RiskLevel = "green" | "yellow" | "red";

export interface Ingredient {
  name: string;
  risk: RiskLevel;
  note: string;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  image: string;
  barcode: string;
  healthScore: number;
  ingredients: Ingredient[];
  notes: { title: string; body: string }[];
  alternatives: string[];
}

export const categories = [
  { id: "snacks", label: "Snacks", image: snacks },
  { id: "drinks", label: "Drinks", image: drinks },
  { id: "noodles", label: "Noodles", image: noodles },
  { id: "biscuits", label: "Biscuits", image: biscuits },
  { id: "chocolates", label: "Chocolates", image: chocolates },
];

export const products: Product[] = [
  {
    id: "p1",
    name: "Magic Masala Chips",
    brand: "Lay's India",
    category: "snacks",
    image: snacks,
    barcode: "8901491100013",
    healthScore: 38,
    ingredients: [
      { name: "Potatoes", risk: "green", note: "Whole food base" },
      { name: "Palm Oil", risk: "yellow", note: "High in saturated fat" },
      { name: "Monosodium Glutamate (E621)", risk: "red", note: "Flavour enhancer linked to overconsumption" },
      { name: "Acidity Regulator (E330)", risk: "green", note: "Citric acid, generally safe" },
      { name: "Artificial Colour (E129)", risk: "red", note: "Allura Red — restricted in some countries" },
      { name: "Iodised Salt", risk: "yellow", note: "Sodium content is high" },
    ],
    notes: [
      { title: "Ultra-processed", body: "Contains multiple additives and flavour enhancers typical of UPFs." },
      { title: "High Sodium", body: "A single 52g pack provides ~30% of daily sodium limit." },
    ],
    alternatives: ["p2", "p5"],
  },
  {
    id: "p2",
    name: "Baked Ragi Chips",
    brand: "Too Yumm",
    category: "snacks",
    image: snacks,
    barcode: "8904245200017",
    healthScore: 74,
    ingredients: [
      { name: "Ragi Flour", risk: "green", note: "Whole millet, rich in calcium" },
      { name: "Rice Flour", risk: "green", note: "Refined but safe" },
      { name: "Sunflower Oil", risk: "yellow", note: "High omega-6 in excess" },
      { name: "Rock Salt", risk: "green", note: "Mineral source" },
    ],
    notes: [{ title: "Baked, not fried", body: "Significantly lower fat than fried alternatives." }],
    alternatives: [],
  },
  {
    id: "p3",
    name: "Maggi 2-Minute Noodles",
    brand: "Nestlé",
    category: "noodles",
    image: noodles,
    barcode: "8901058851656",
    healthScore: 32,
    ingredients: [
      { name: "Refined Wheat Flour (Maida)", risk: "red", note: "Stripped of fibre and nutrients" },
      { name: "Palm Oil", risk: "yellow", note: "Saturated fat heavy" },
      { name: "Salt", risk: "yellow", note: "High sodium per serving" },
      { name: "Wheat Gluten", risk: "green", note: "Safe unless intolerant" },
      { name: "Flavour Enhancers (E627, E631)", risk: "red", note: "Synthetic enhancers" },
    ],
    notes: [
      { title: "Refined Carbs", body: "Maida spikes blood sugar quickly." },
      { title: "Tastemaker is the issue", body: "Most additives sit in the seasoning sachet." },
    ],
    alternatives: ["p4"],
  },
  {
    id: "p4",
    name: "Atta Noodles Masala",
    brand: "Patanjali",
    category: "noodles",
    image: noodles,
    barcode: "8904109485712",
    healthScore: 61,
    ingredients: [
      { name: "Whole Wheat Atta", risk: "green", note: "Fibre rich" },
      { name: "Palm Oil", risk: "yellow", note: "Use sparingly" },
      { name: "Spices", risk: "green", note: "Natural seasoning" },
      { name: "Salt", risk: "yellow", note: "Moderate sodium" },
    ],
    notes: [{ title: "Whole grain base", body: "Atta provides slower glucose release than maida." }],
    alternatives: [],
  },
  {
    id: "p5",
    name: "Roasted Makhana",
    brand: "Farmley",
    category: "snacks",
    image: snacks,
    barcode: "8908004700014",
    healthScore: 88,
    ingredients: [
      { name: "Fox Nuts (Makhana)", risk: "green", note: "Low calorie, high protein" },
      { name: "Olive Oil", risk: "green", note: "Heart healthy" },
      { name: "Pink Salt", risk: "green", note: "Mineral rich" },
      { name: "Black Pepper", risk: "green", note: "Natural" },
    ],
    notes: [{ title: "Clean label", body: "Just 4 ingredients, all recognisable." }],
    alternatives: [],
  },
  {
    id: "p6",
    name: "Parle-G Original",
    brand: "Parle",
    category: "biscuits",
    image: biscuits,
    barcode: "8901719101007",
    healthScore: 42,
    ingredients: [
      { name: "Wheat Flour", risk: "yellow", note: "Refined" },
      { name: "Sugar", risk: "red", note: "Added sugars" },
      { name: "Edible Vegetable Oils", risk: "yellow", note: "Unspecified blend" },
      { name: "Invert Syrup", risk: "red", note: "Concentrated sugar" },
      { name: "Raising Agents", risk: "green", note: "Standard leavening" },
    ],
    notes: [{ title: "Sugar heavy", body: "~25% of weight is added sugar." }],
    alternatives: ["p2", "p5"],
  },
];

export const getProduct = (id: string) => products.find(p => p.id === id);