import crypto from "crypto";
import jwt from "jsonwebtoken";

const QR_SECRET = process.env.JWT_SECRET || "Salt123";
const HMAC_SIG_LENGTH = 12; // 12 hex chars = 48 bits, plenty for tamper detection

export interface QRPayload {
  orderId: string;
  // Legacy fields — kept optional for backward compat with old JWT tokens
  eventId?: string;
  userId?: string;
  quantity?: number;
  issuedAt?: number;
  expiresAt?: number;
}

/**
 * Generate a compact HMAC-signed QR token.
 * Format: ORDERID.HMACHEX  (all uppercase, QR alphanumeric-mode friendly)
 * Example: ORD-MLGEHV5N-0FSUFT.54D513F8B60E  (32 chars vs 125 for JWT)
 */
export function generateQRCode(data: { orderId: string }): string {
  const sig = crypto
    .createHmac("sha256", QR_SECRET)
    .update(data.orderId)
    .digest("hex")
    .toUpperCase()
    .slice(0, HMAC_SIG_LENGTH);
  return `${data.orderId}.${sig}`;
}

/**
 * Verify and decode a QR code.
 * Supports both new HMAC format and legacy JWT tokens.
 */
export function verifyQRCode(token: string): {
  valid: boolean;
  payload?: QRPayload;
  error?: string;
} {
  const parts = token.split(".");

  // New HMAC format: ORDERID.HEXSIG (exactly 2 parts)
  if (parts.length === 2) {
    const [orderId, sig] = parts;
    const expectedSig = crypto
      .createHmac("sha256", QR_SECRET)
      .update(orderId)
      .digest("hex")
      .toUpperCase()
      .slice(0, HMAC_SIG_LENGTH);

    if (sig === expectedSig) {
      return { valid: true, payload: { orderId } };
    }
    return { valid: false, error: "Invalid QR" };
  }

  // Fallback: legacy JWT verification (3 parts)
  try {
    const payload = jwt.verify(token, QR_SECRET, {
      algorithms: ["HS256"],
    }) as QRPayload;

    if (payload.expiresAt && payload.expiresAt < Date.now()) {
      return { valid: false, error: "Expired QR" };
    }

    return { valid: true, payload };
  } catch {
    return { valid: false, error: "Invalid QR" };
  }
}

/**
 * Extract order ID from QR code without full verification.
 * Supports both HMAC and legacy JWT formats.
 */
export function extractOrderId(token: string): string | null {
  try {
    const parts = token.split(".");
    // HMAC format: 2 parts
    if (parts.length === 2 && parts[0].startsWith("ORD-")) {
      return parts[0];
    }
    // Legacy JWT: 3 parts
    const decoded = jwt.decode(token) as QRPayload | null;
    return decoded?.orderId || null;
  } catch {
    return null;
  }
}
