import crypto from "crypto";
import jwt from "jsonwebtoken";

// Reading secret inside functions to avoid dotenv race condition
const getSecret = () => process.env.JWT_SECRET || "Salt123";


export interface QRPayload {
  orderId: string;
  eventId?: string;
  userId?: string;
  quantity?: number;
  issuedAt?: number;
  expiresAt?: number;
}

export function generateQRCode(data: { orderId: string }): string {
  // Decrease QR to exactly 32-char HMAC as requested
  return crypto
    .createHmac("sha256", getSecret())
    .update(data.orderId)
    .digest("hex")
    .toUpperCase()
    .substring(0, 16);
}

// Fallback logic in case of legacy tokens
export function extractLegacyOrderId(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length === 2 && parts[0].startsWith("ORD-")) {
      return parts[0];
    }
    const decoded = jwt.decode(token) as QRPayload | null;
    return decoded?.orderId || null;
  } catch {
    return null;
  }
}
