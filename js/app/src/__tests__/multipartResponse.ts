export function buildStrawberryMultipartBody(parts: unknown[]): string {
  const encodedParts = parts.map((part) => {
    const json = JSON.stringify(part);
    return `\r\nContent-Type: application/json; charset=utf-8\r\nContent-Length: ${json.length}\r\n\r\n${json}\r\n---`;
  });
  return `---${encodedParts.join("")}--\r\n`;
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
  return new Response(stream, {
    status,
    headers: { "Content-Type": 'multipart/mixed; boundary="-"' },
  });
}
