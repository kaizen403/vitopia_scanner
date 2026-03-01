import { describe, expect, it } from "vitest";
import { generateStyledQRImage, generateStyledQRDataUrl } from "../utils/qr-image.js";
import { generateQRCode } from "../utils/qr-code.js";

describe("QR Image Generation", () => {
    const sampleOrderId = "TEST-IMG-ORDER-123";
    const token = generateQRCode({ orderId: sampleOrderId });

    describe("generateStyledQRImage", () => {
        it("generates a valid PNG Buffer", async () => {
            const result = await generateStyledQRImage(token);

            expect(Buffer.isBuffer(result)).toBe(true);
            expect(result.length).toBeGreaterThan(0);

            // Check for strictly PNG header magic bytes (89 50 4E 47 0D 0A 1A 0A)
            expect(result.slice(0, 8)).toEqual(
                Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
            );
        });

        it("generates deterministic images for the same token", async () => {
            const buffer1 = await generateStyledQRImage(token);
            const buffer2 = await generateStyledQRImage(token);

            expect(buffer1.equals(buffer2)).toBe(true);
        });
    });

    describe("generateStyledQRDataUrl", () => {
        it("returns a valid base64 data URL", async () => {
            const dataUrl = await generateStyledQRDataUrl(token);

            expect(typeof dataUrl).toBe("string");
            expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);

            // Ensure the rest is valid base64
            const base64Data = dataUrl.split(",")[1];
            const decodedBuffer = Buffer.from(base64Data, "base64");

            // It should still decode back to the same PNG magic bytes
            expect(decodedBuffer.slice(0, 8)).toEqual(
                Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
            );
        });
    });
});
