import { consumeMultipartBody, readMultipartBody } from "../index";

/**
 * Create a Response with a ReadableStream body from a raw string, simulating
 * a multipart/mixed HTTP response.
 */
function createMultipartResponse(body: string, boundary = "graphql"): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(body));
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": `multipart/mixed; boundary=${boundary}`,
    },
  });
}

/**
 * Create a Response whose body is delivered one byte at a time, to test
 * that boundary detection works when boundaries span multiple chunks.
 */
function createChunkedResponse(body: string, boundary = "graphql"): Response {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(body);
  const stream = new ReadableStream({
    start(controller) {
      for (let i = 0; i < bytes.length; i++) {
        controller.enqueue(bytes.slice(i, i + 1));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": `multipart/mixed; boundary=${boundary}`,
    },
  });
}

describe("consumeMultipartBody", () => {
  it("yields each part body from a two-part response", async () => {
    const body =
      '\r\n--graphql\r\nContent-Type: application/json\r\n\r\n{"data":{"a":1},"hasNext":true}' +
      '\r\n--graphql\r\nContent-Type: application/json\r\n\r\n{"incremental":[{"data":{"b":2}}],"hasNext":false}' +
      "\r\n--graphql--\r\n";

    const response = createMultipartResponse(body);
    const parts: string[] = [];
    for await (const part of consumeMultipartBody(response)) {
      parts.push(part.trim());
    }

    expect(parts).toHaveLength(2);
    expect(JSON.parse(parts[0])).toEqual({ data: { a: 1 }, hasNext: true });
    expect(JSON.parse(parts[1])).toEqual({
      incremental: [{ data: { b: 2 } }],
      hasNext: false,
    });
  });

  it("handles double-quoted boundary values", async () => {
    const body =
      '\r\n--myboundary\r\nContent-Type: application/json\r\n\r\n{"data":{"x":1}}' +
      "\r\n--myboundary--\r\n";

    const response = createMultipartResponse(body, '"myboundary"');
    const parts: string[] = [];
    for await (const part of consumeMultipartBody(response)) {
      parts.push(part.trim());
    }

    expect(parts).toHaveLength(1);
    expect(JSON.parse(parts[0])).toEqual({ data: { x: 1 } });
  });

  it("handles unquoted boundary with trailing parameters", async () => {
    const body =
      '\r\n--graphql\r\nContent-Type: application/json\r\n\r\n{"data":{"x":1}}' +
      "\r\n--graphql--\r\n";

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(body));
        controller.close();
      },
    });
    const response = new Response(stream, {
      headers: {
        "Content-Type": "multipart/mixed; boundary=graphql; deferSpec=20220824",
      },
    });

    const parts: string[] = [];
    for await (const part of consumeMultipartBody(response)) {
      parts.push(part.trim());
    }

    expect(parts).toHaveLength(1);
    expect(JSON.parse(parts[0])).toEqual({ data: { x: 1 } });
  });

  it("throws on non-JSON content type in a part", async () => {
    const body =
      "\r\n--graphql\r\nContent-Type: text/plain\r\n\r\nhello" +
      "\r\n--graphql--\r\n";

    const response = createMultipartResponse(body);

    await expect(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of consumeMultipartBody(response)) {
        // drain
      }
    }).rejects.toThrow("Unsupported patch content type");
  });

  it("throws on premature end of stream", async () => {
    // No final boundary marker
    const body =
      '\r\n--graphql\r\nContent-Type: application/json\r\n\r\n{"data":{"a":1}}';

    const response = createMultipartResponse(body);

    await expect(async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _ of consumeMultipartBody(response)) {
        // drain
      }
    }).rejects.toThrow("premature end of multipart body");
  });

  it("handles boundaries that span multiple chunks", async () => {
    const body =
      '\r\n--graphql\r\nContent-Type: application/json\r\n\r\n{"data":{"a":1},"hasNext":true}' +
      '\r\n--graphql\r\nContent-Type: application/json\r\n\r\n{"data":{"b":2},"hasNext":false}' +
      "\r\n--graphql--\r\n";

    // Deliver byte-by-byte to force boundary to span chunks
    const response = createChunkedResponse(body);
    const parts: string[] = [];
    for await (const part of consumeMultipartBody(response)) {
      parts.push(part.trim());
    }

    expect(parts).toHaveLength(2);
    expect(JSON.parse(parts[0])).toEqual({ data: { a: 1 }, hasNext: true });
    expect(JSON.parse(parts[1])).toEqual({ data: { b: 2 }, hasNext: false });
  });

  it("skips preamble content before the first boundary", async () => {
    const body =
      "this is preamble text that should be ignored" +
      '\r\n--graphql\r\nContent-Type: application/json\r\n\r\n{"data":{"a":1}}' +
      "\r\n--graphql--\r\n";

    const response = createMultipartResponse(body);
    const parts: string[] = [];
    for await (const part of consumeMultipartBody(response)) {
      parts.push(part.trim());
    }

    expect(parts).toHaveLength(1);
    expect(JSON.parse(parts[0])).toEqual({ data: { a: 1 } });
  });
});

describe("readMultipartBody", () => {
  it("calls nextValue for each parsed JSON result", async () => {
    const body =
      '\r\n--graphql\r\nContent-Type: application/json\r\n\r\n{"data":{"viewer":{"id":"1"}},"hasNext":true}' +
      '\r\n--graphql\r\nContent-Type: application/json\r\n\r\n{"incremental":[{"data":{"name":"test"},"path":["viewer"],"label":"Deferred"}],"hasNext":false}' +
      "\r\n--graphql--\r\n";

    const response = createMultipartResponse(body);
    const results: unknown[] = [];
    await readMultipartBody(response, (value) => results.push(value));

    // The incremental envelope is unwrapped into flat payloads for Relay
    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      data: { viewer: { id: "1" } },
      hasNext: true,
    });
    expect(results[1]).toEqual({
      data: { name: "test" },
      path: ["viewer"],
      label: "Deferred",
      hasNext: false,
    });
  });

  it("unwraps multiple items in a single incremental array", async () => {
    const body =
      '\r\n--graphql\r\nContent-Type: application/json\r\n\r\n{"data":{"node":{"id":"1"}},"hasNext":true}' +
      '\r\n--graphql\r\nContent-Type: application/json\r\n\r\n{"incremental":[{"data":{"a":1},"path":["node"],"label":"A"},{"data":{"b":2},"path":["node"],"label":"B"}],"hasNext":false}' +
      "\r\n--graphql--\r\n";

    const response = createMultipartResponse(body);
    const results: unknown[] = [];
    await readMultipartBody(response, (value) => results.push(value));

    expect(results).toHaveLength(3);
    expect(results[0]).toEqual({
      data: { node: { id: "1" } },
      hasNext: true,
    });
    // First item in incremental array: hasNext is true (more items follow)
    expect(results[1]).toEqual({
      data: { a: 1 },
      path: ["node"],
      label: "A",
      hasNext: true,
    });
    // Last item inherits hasNext from the envelope
    expect(results[2]).toEqual({
      data: { b: 2 },
      path: ["node"],
      label: "B",
      hasNext: false,
    });
  });

  it("skips empty JSON objects", async () => {
    const body =
      "\r\n--graphql\r\nContent-Type: application/json\r\n\r\n{}" +
      '\r\n--graphql\r\nContent-Type: application/json\r\n\r\n{"data":{"a":1}}' +
      "\r\n--graphql--\r\n";

    const response = createMultipartResponse(body);
    const results: unknown[] = [];
    await readMultipartBody(response, (value) => results.push(value));

    expect(results).toHaveLength(1);
    expect(results[0]).toEqual({ data: { a: 1 } });
  });

  it("throws on invalid JSON in a part", async () => {
    const body =
      "\r\n--graphql\r\nContent-Type: application/json\r\n\r\n{invalid json}" +
      "\r\n--graphql--\r\n";

    const response = createMultipartResponse(body);
    await expect(readMultipartBody(response, () => {})).rejects.toThrow();
  });
});
