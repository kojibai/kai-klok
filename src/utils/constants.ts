/* ────────────────────────────────────────────────────────────────
   constants.ts  –  Global constants for Maturah API and Frontend
──────────────────────────────────────────────────────────────── */

/* Backend API Base URL */
export const API_BASE = import.meta.env.VITE_API_BASE || "https://api.maturah.com";

/* Stripe Price ID (Subscription Plan) */
export const STRIPE_PRICE_ID = import.meta.env.VITE_STRIPE_PRICE_ID || "";

/* Frontend Base URL (where users land after checkout) */
export const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL || "https://maturah.com";

/* Stripe Publishable Key (for frontend Stripe checkout if needed) */
export const STRIPE_PUBLIC_KEY = import.meta.env.VITE_STRIPE_PUBLIC_KEY || "";

/* Trial period (if you want to reference it anywhere frontend) */
export const TRIAL_DAYS = 3;

/* Product Details (optional — use for checkout display if needed) */
export const PRODUCT_NAME = "Maturah Cosmic Portal Membership";
export const PRODUCT_PRICE = 11.11;
export const PRODUCT_CURRENCY = "USD";
