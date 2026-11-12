const MULTIPART_HEADERS = { "Content-Type": 'multipart/mixed; boundary="-"' };

function encodeStrawberryMultipartPart(part: unknown): string {
  const json = JSON.stringify(part);
  return `\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: ${json.length}\r\n\r\n${json}\r\n---`;
}

export function buildStrawberryMultipartBody(parts: unknown[]): string {
  return `---${parts.map(encodeStrawberryMultipartPart).join("")}--\r\n`;
}

export function createMultipartResponse({
  body,
  chunkSize = body.length,
  status = 200,
}: {
  body: string;
  chunkSize?: number;
  status?: number;
}): Response {
  const bytes = new TextEncoder().encode(body);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        controller.enqueue(bytes.slice(offset, offset + chunkSize));
      }
      controller.close();
    },
  });
  return new Response(stream, { status, headers: MULTIPART_HEADERS });
}

/**
 * A multipart response whose parts the test sends one at a time, and which it
 * can end, cut off before the closing delimiter, or fail mid-stream.
 */
export function createStreamingMultipartResponse() {
  const encoder = new TextEncoder();
  let streamController!: ReadableStreamDefaultController<Uint8Array>;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      streamController = controller;
      controller.enqueue(encoder.encode("---"));
    },
  });
  return {
    response: new Response(stream, { status: 200, headers: MULTIPART_HEADERS }),
    sendPart: (part: unknown) =>
      streamController.enqueue(
        encoder.encode(encodeStrawberryMultipartPart(part))
      ),
    end: () => {
      streamController.enqueue(encoder.encode("--\r\n"));
      streamController.close();
    },
    cutOff: () => streamController.close(),
    fail: (error: Error) => streamController.error(error),
  };
}
