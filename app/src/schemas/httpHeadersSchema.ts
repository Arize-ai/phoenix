import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

/**
 * HTTP header name validation following RFC 7230
 * Header names are case-insensitive and consist of ASCII letters, digits, and certain special characters
 */
const httpHeaderNameSchema = z
  .string()
  .min(1, "Header name cannot be empty")
  .regex(
    /^[A-Za-z0-9!#$%&'*+\-.^_`|~]+$/,
    "Header name must only contain valid HTTP header characters (letters, numbers, and !#$%&'*+-.^_`|~)"
  );

/**
 * HTTP header value validation following RFC 7230
 * Header values can contain any visible ASCII characters and spaces/tabs
 */
const httpHeaderValueSchema = z
  .string()
  .refine(
    (value) => /^[\x20-\x7E\t]*$/.test(value),
    "Header value must only contain visible ASCII characters"
  );

/**
 * Schema for HTTP headers as a key-value object
 */
export const httpHeadersSchema = z
  .record(httpHeaderNameSchema, httpHeaderValueSchema)
  .describe("HTTP headers as key-value pairs")
  .refine((headers) => {
    // Check for duplicate header names (case-insensitive)
    const names = Object.keys(headers);
    const lowerNames = names.map((name) => name.toLowerCase());
    const uniqueNames = new Set(lowerNames);
    return uniqueNames.size === names.length;
  }, "Duplicate header names are not allowed (header names are case-insensitive)");

/**
 * The type of HTTP headers
 */
export type HttpHeaders = z.infer<typeof httpHeadersSchema>;

/**
 * JSON Schema for HTTP headers (for JSONEditor validation)
 */
export const httpHeadersJSONSchema = zodToJsonSchema(httpHeadersSchema, {
  name: "HttpHeaders",
  definitions: {},
});
