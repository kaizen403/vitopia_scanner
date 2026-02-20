import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../app.js";

describe("GET /health", () => {
  it("returns service metadata", async () => {
    const app = createApp({ enableNotFound: false });
    const response = await request(app).get("/health");

    const expectedService = process.env.FORCE_FAIL_HEALTH_TEST
      ? "forced-failure-service"
      : "fest-entry-verification";

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(response.body.service).toBe(expectedService);
    expect(Date.parse(response.body.timestamp)).not.toBeNaN();
  });
});
