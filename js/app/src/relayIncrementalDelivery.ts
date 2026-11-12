export const INCREMENTAL_ACCEPT_HEADER =
  "multipart/mixed; deferSpec=20220824, application/json";

export function usesIncrementalDelivery(operationText: string | null) {
  return operationText != null && /@defer\b/.test(operationText);
}

export function isMultipartMixedResponse(response: Response) {
  return /^multipart\/mixed\b/i.test(
    response.headers.get("content-type") ?? ""
  );
}

function getBoundary(response: Response): string {
  const contentType = response.headers.get("content-type") ?? "";
  const match = /boundary="?([^";]+)"?/i.exec(contentType);
  return match?.[1] ?? "-";
}

export async function* readMultipartMixed(
  response: Response
): AsyncGenerator<unknown> {
  if (response.body == null) {
    return;
  }
  const delimiter = `\r\n--${getBoundary(response)}`;
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  // A leading CRLF lets the opening delimiter match like the others.
  let buffer = "\r\n";
  let isPastPreamble = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      return;
    }
    buffer += value;
    let index = buffer.indexOf(delimiter);
    while (index !== -1) {
      const part = buffer.slice(0, index);
      buffer = buffer.slice(index + delimiter.length);
      if (isPastPreamble) {
        const bodyStart = part.indexOf("\r\n\r\n");
        const body = bodyStart === -1 ? "" : part.slice(bodyStart + 4).trim();
        if (body !== "") {
          yield JSON.parse(body);
        }
      }
      isPastPreamble = true;
      const isClosingDelimiter = buffer.startsWith("--");
      if (isClosingDelimiter) {
        await reader.cancel();
        return;
      }
      index = buffer.indexOf(delimiter);
    }
  }
}
