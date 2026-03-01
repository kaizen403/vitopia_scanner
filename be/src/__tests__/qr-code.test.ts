import { describe, expect, it, vi } from "vitest";
import { generateQRCode, extractLegacyOrderId } from "../utils/qr-code.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";

describe("QR Code Utilities", () => {
    describe("generateQRCode", () => {
        it("generates a 16-character uppercase hex string", () => {
            const orderId = "PRAANA-REG-123";
            const token = generateQRCode({ orderId });

            expect(token).toBeTypeOf("string");
            expect(token.length).toBe(16);
            expect(token).toMatch(/^[0-9A-F]+$/);
        });

        it("generates deterministic tokens for the same input", () => {
            const orderId = "TEST-ORDER-456";
            const token1 = generateQRCode({ orderId });
            const token2 = generateQRCode({ orderId });

            expect(token1).toBe(token2);
        });

        it("uses JWT_SECRET for HMAC generation", () => {
            const originalSecret = process.env.JWT_SECRET;
            process.env.JWT_SECRET = "test-secret";

            const orderId = "SECURE-ORDER";
            const expectedToken = crypto
                .createHmac("sha256", "test-secret")
                .update(orderId)
                .digest("hex")
                .toUpperCase()
                .substring(0, 16);

            const token = generateQRCode({ orderId });
            expect(token).toBe(expectedToken);

            process.env.JWT_SECRET = originalSecret;
        });
    });

    describe("extractLegacyOrderId", () => {
        it("extracts order ID from legacy ORD- format", () => {
            const legacyToken = "ORD-789.some-signature-or-random-string";
            const extracted = extractLegacyOrderId(legacyToken);
            expect(extracted).toBe("ORD-789");
        });

        it("extracts order ID from JWT format", () => {
            const orderId = "JWT-ORDER-001";
            const token = jwt.sign({ orderId }, "secret123");
            const extracted = extractLegacyOrderId(token);
            expect(extracted).toBe(orderId);
        });

        it("returns null for invalid formats", () => {
            expect(extractLegacyOrderId("invalid-token-format")).toBeNull();
            expect(extractLegacyOrderId("")).toBeNull();
            expect(extractLegacyOrderId("A.B.C")).toBeNull(); // Invalid JWT
        });
    });
});
