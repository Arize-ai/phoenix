import { stringToHttpHeadersSchema } from "../httpHeadersSchema";

describe("httpHeadersSchema", () => {
  describe("stringToHttpHeadersSchema", () => {
    // Empty states
    it("should return null for empty states", () => {
      expect(stringToHttpHeadersSchema.safeParse("").data).toBeNull();
      expect(stringToHttpHeadersSchema.safeParse("{}").data).toBeNull();
      expect(stringToHttpHeadersSchema.safeParse("{\n  \n}").data).toBeNull();
    });

    // Valid headers
    it("should parse valid HTTP headers", () => {
      const input =
        '{"Authorization": "Bearer token", "Content-Type": "application/json"}';
      const result = stringToHttpHeadersSchema.safeParse(input);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        Authorization: "Bearer token",
        "Content-Type": "application/json",
      });
    });

    // Duplicate key detection
    it("should detect exact duplicate keys", () => {
      const input = '{"Authorization": "token1", "Authorization": "token2"}';
      const result = stringToHttpHeadersSchema.safeParse(input);

      expect(result.success).toBe(false);
      expect(result.error?.errors[0]?.message).toBe(
        "Duplicate keys found in JSON object"
      );
    });

    it("should detect case-insensitive duplicate headers", () => {
      const input = '{"Authorization": "token1", "authorization": "token2"}';
      const result = stringToHttpHeadersSchema.safeParse(input);

      expect(result.success).toBe(false);
      expect(result.error?.errors[0]?.message).toBe(
        "Duplicate header names found (header names are case-insensitive)"
      );
    });

    // Conservative approach - skip complex JSON
    it("should skip duplicate detection for nested objects", () => {
      const input = '{"config": {"timeout": 30}, "headers": {"timeout": "5s"}}';
      const result = stringToHttpHeadersSchema.safeParse(input);

      // These should fail validation due to invalid header structure (objects as values)
      // but NOT due to duplicate detection
      expect(result.success).toBe(false);
      expect(result.error?.errors[0]?.message).not.toContain("Duplicate");
    });

    it("should skip duplicate detection for arrays", () => {
      const input = '{"items": [1, 2, 3], "count": 3}';
      const result = stringToHttpHeadersSchema.safeParse(input);

      // Should fail due to array value, not duplicate detection
      expect(result.success).toBe(false);
      expect(result.error?.errors[0]?.message).not.toContain("Duplicate");
    });

    it("should successfully skip duplicate detection for valid flat objects", () => {
      // This would normally trigger duplicate detection if it wasn't conservative
      const input = '{"Authorization": "Bearer token", "X-Custom": "value"}';
      const result = stringToHttpHeadersSchema.safeParse(input);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        Authorization: "Bearer token",
        "X-Custom": "value",
      });
    });

    // Escape sequence handling
    it("should handle escaped quotes in header names", () => {
      const input = '{"key\\"with\\"quotes": "value", "other": "test"}';
      const result = stringToHttpHeadersSchema.safeParse(input);

      // This should fail because quotes in header names are invalid per RFC 7230
      expect(result.success).toBe(false);
      expect(result.error?.errors[0]?.message).toContain(
        "valid HTTP header characters"
      );
    });

    // Header validation
    it("should reject invalid header names", () => {
      const input = '{"invalid header name": "value"}';
      const result = stringToHttpHeadersSchema.safeParse(input);

      expect(result.success).toBe(false);
      expect(result.error?.errors[0]?.message).toContain(
        "valid HTTP header characters"
      );
    });

    it("should reject invalid header values", () => {
      const input =
        '{"Authorization": "value\\u0001with\\u0001control\\u0001chars"}';
      const result = stringToHttpHeadersSchema.safeParse(input);

      expect(result.success).toBe(false);
      expect(result.error?.errors[0]?.message).toContain(
        "visible ASCII characters"
      );
    });

    // Invalid JSON
    it("should handle invalid JSON gracefully", () => {
      const input = '{"invalid": json}';
      const result = stringToHttpHeadersSchema.safeParse(input);

      expect(result.success).toBe(false);
      expect(result.error?.errors[0]?.message).toBe("Invalid JSON format");
    });

    it("should reject non-object JSON", () => {
      const input = '"just a string"';
      const result = stringToHttpHeadersSchema.safeParse(input);

      expect(result.success).toBe(false);
      expect(result.error?.errors[0]?.message).toBe(
        "Must be a valid JSON object"
      );
    });
  });
});
