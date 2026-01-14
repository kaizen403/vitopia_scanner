import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your-super-secret-jwt-key-change-in-production";

export interface QRPayload {
  orderId: string;
  eventId: string;
  userId: string;
  quantity: number;
  issuedAt: number;
  expiresAt: number;
}

/**
 * Generate a signed QR code payload
 */
export function generateQRCode(data: {
  orderId: string;
  eventId: string;
  userId: string;
  quantity: number;
}): string {
  const payload: QRPayload = {
    ...data,
    issuedAt: Date.now(),
    expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000, // 1 year validity
  };

  const token = jwt.sign(payload, JWT_SECRET, {
    algorithm: "HS256",
  });

  return token;
}

/**
 * Verify and decode a QR code
 */
export function verifyQRCode(token: string): {
  valid: boolean;
  payload?: QRPayload;
  error?: string;
} {
  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS256"],
    }) as QRPayload;

    // Check expiration
    if (payload.expiresAt < Date.now()) {
      return { valid: false, error: "Expired QR" };
    }

    return { valid: true, payload };
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return { valid: false, error: "Invalid QR" };
    }
    if (error instanceof jwt.TokenExpiredError) {
      return { valid: false, error: "Expired QR" };
    }
    return { valid: false, error: "Invalid QR" };
  }
}

/**
 * Extract order ID from QR code without full verification
 * Used for quick lookups
 */
export function extractOrderId(token: string): string | null {
  try {
    const decoded = jwt.decode(token) as QRPayload | null;
    return decoded?.orderId || null;
  } catch {
    return null;
  }
}
