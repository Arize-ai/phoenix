import { Observable } from "relay-runtime";

/**
 * Creates a Relay-compatible subscription function that uses multipart HTTP
 * streaming (GraphQL over HTTP multipart subscriptions).
 *
 * This is a standalone replacement for
 * @apollo/client/utilities/subscriptions/relay that avoids pulling in the
 * entire Apollo Client bundle (~15 MB on disk).
 */
export function createFetchMultipartSubscription(
  uri: string,
  {
    fetch: preferredFetch,
    headers,
  }: { fetch?: typeof globalThis.fetch; headers?: Record<string, string> } = {}
) {
  return function fetchMultipartSubscription(
    operation: { name: string; text: string | null },
    variables: Record<string, unknown>
  ) {
    return Observable.create((sink) => {
      const controller = new AbortController();
      const currentFetch = preferredFetch || fetch;

      currentFetch(uri, {
        method: "POST",
        headers: {
          ...(headers || {}),
          "content-type": "application/json",
          accept:
            "multipart/mixed;boundary=graphql;subscriptionSpec=1.0,application/json",
        },
        body: JSON.stringify({
          operationName: operation.name,
          variables,
          query: operation.text || "",
        }),
        signal: controller.signal,
      })
        .then(async (response) => {
          const ctype = response.headers?.get("content-type");
          if (ctype !== null && /^multipart\/mixed/i.test(ctype)) {
            await readMultipartBody(response, sink.next.bind(sink));
          } else {
            sink.error(new Error("Expected multipart response"));
          }
        })
        .then(() => {
          sink.complete();
        })
        .catch((err: Error) => {
          if (err.name !== "AbortError") {
            sink.error(err);
          }
        });

      return () => {
        controller.abort();
      };
    });
  };
}

async function* consumeMultipartBody(response: Response) {
  const decoder = new TextDecoder("utf-8");
  const contentType = response.headers?.get("content-type");
  // Parse boundary from Content-Type header per RFC 9110
  const match = contentType?.match(
    /;\s*boundary=(?:'([^']+)'|"([^"]+)"|([^"'].+?))\s*(?:;|$)/i
  );
  const boundary =
    "\r\n--" + (match ? (match[1] ?? match[2] ?? match[3] ?? "-") : "-");

  let buffer = "";

  if (!response.body || typeof response.body.getReader !== "function") {
    throw new Error("Response body is not readable");
  }

  const reader = response.body.getReader();
  let done = false;
  let encounteredBoundary = false;

  const passedFinalBoundary = () =>
    encounteredBoundary && buffer[0] === "-" && buffer[1] === "-";

  try {
    while (!done) {
      const readResult = await reader.read();
      done = readResult.done;
      const chunk =
        typeof readResult.value === "string"
          ? readResult.value
          : decoder.decode(readResult.value);
      const searchFrom = buffer.length - boundary.length + 1;
      buffer += chunk;
      let bi = buffer.indexOf(boundary, searchFrom);

      while (bi > -1 && !passedFinalBoundary()) {
        encounteredBoundary = true;
        let message: string;
        [message, buffer] = [
          buffer.slice(0, bi),
          buffer.slice(bi + boundary.length),
        ];
        const i = message.indexOf("\r\n\r\n");
        const body = message.slice(i);
        if (body) {
          yield body;
        }
        bi = buffer.indexOf(boundary);
      }

      if (passedFinalBoundary()) {
        return;
      }
    }
    throw new Error("premature end of multipart body");
  } finally {
    reader.cancel();
  }
}

async function readMultipartBody(
  response: Response,
  nextValue: (value: unknown) => void
) {
  for await (const body of consumeMultipartBody(response)) {
    const result = JSON.parse(body);
    if (Object.keys(result).length === 0) continue;

    if (typeof result === "object" && result !== null && "payload" in result) {
      if (Object.keys(result).length === 1 && result.payload === null) {
        return;
      }
      nextValue({ ...result.payload });
    } else {
      nextValue(result);
    }
  }
}
