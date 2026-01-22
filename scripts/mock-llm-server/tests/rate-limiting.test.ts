import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { startServer, stopServer, getTestClient, resetRateLimit, getBaseUrl } from "./setup";
import { APIError } from "openai";

describe("Rate Limiting", () => {
  describe("after_n mode", () => {
    beforeAll(async () => {
      await startServer({
        RATE_LIMIT_ENABLED: "true",
        RATE_LIMIT_MODE: "after_n",
        RATE_LIMIT_AFTER_N: "3",
      });
    });

    afterAll(async () => {
      await stopServer();
    });

    beforeEach(async () => {
      await resetRateLimit();
    });

    it("should allow first N requests and then rate limit", async () => {
      const client = getTestClient();
      const messages = [{ role: "user" as const, content: "Hello" }];

      // First 3 requests should succeed
      for (let i = 0; i < 3; i++) {
        const response = await client.chat.completions.create({
          model: "gpt-4o",
          messages,
        });
        expect(response.choices[0].message.content).toBeTruthy();
      }

      // 4th request should be rate limited
      try {
        await client.chat.completions.create({
          model: "gpt-4o",
          messages,
        });
        expect.fail("Should have thrown rate limit error");
      } catch (error) {
        expect(error).toBeInstanceOf(APIError);
        const apiError = error as APIError;
        expect(apiError.status).toBe(429);
      }
    });

    it("should include rate limit headers", async () => {
      const baseUrl = getBaseUrl();

      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-key",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "user", content: "Hello" }],
        }),
      });

      expect(response.headers.get("x-ratelimit-limit-requests")).toBeTruthy();
      expect(response.headers.get("x-ratelimit-remaining-requests")).toBeTruthy();
    });

    it("should include retry-after and retry-after-ms headers on 429", async () => {
      const baseUrl = getBaseUrl();

      // Exhaust the rate limit (3 requests)
      for (let i = 0; i < 3; i++) {
        await fetch(`${baseUrl}/v1/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-key",
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [{ role: "user", content: "Hello" }],
          }),
        });
      }

      // 4th request should be rate limited with proper headers
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-key",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "user", content: "Hello" }],
        }),
      });

      expect(response.status).toBe(429);
      expect(response.headers.get("retry-after")).toBeTruthy();
      expect(response.headers.get("retry-after-ms")).toBeTruthy();

      // Verify retry-after-ms is a valid number
      const retryAfterMs = parseInt(response.headers.get("retry-after-ms")!, 10);
      expect(retryAfterMs).toBeGreaterThan(0);
    });

    it("should return proper error format on rate limit", async () => {
      const client = getTestClient();
      const messages = [{ role: "user" as const, content: "Hello" }];

      // Exhaust the limit
      for (let i = 0; i < 3; i++) {
        await client.chat.completions.create({ model: "gpt-4o", messages });
      }

      try {
        await client.chat.completions.create({ model: "gpt-4o", messages });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(APIError);
        const apiError = error as APIError;
        expect(apiError.status).toBe(429);
        expect(apiError.message).toContain("Rate limit");
      }
    });
  });

  describe("always mode", () => {
    beforeAll(async () => {
      await startServer({
        RATE_LIMIT_ENABLED: "true",
        RATE_LIMIT_MODE: "always",
      });
    });

    afterAll(async () => {
      await stopServer();
    });

    it("should rate limit every request", async () => {
      const client = getTestClient();

      try {
        await client.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: "Hello" }],
        });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(APIError);
        expect((error as APIError).status).toBe(429);
      }
    });
  });

  describe("disabled", () => {
    beforeAll(async () => {
      await startServer({
        RATE_LIMIT_ENABLED: "false",
      });
    });

    afterAll(async () => {
      await stopServer();
    });

    it("should not rate limit when disabled", async () => {
      const client = getTestClient();
      const messages = [{ role: "user" as const, content: "Hello" }];

      // Should be able to make many requests
      for (let i = 0; i < 10; i++) {
        const response = await client.chat.completions.create({
          model: "gpt-4o",
          messages,
        });
        expect(response.choices[0].message.content).toBeTruthy();
      }
    });
  });
});
