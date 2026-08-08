import { describe, expect, it } from "vitest";

import { buildUserMessageMetadata } from "../userMessageMetadata";

describe("buildUserMessageMetadata", () => {
  it("stamps the browser clock with an offset datetime and IANA timezone", () => {
    const metadata = buildUserMessageMetadata();

    expect(metadata.currentDateTime).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:?\d{2})$/
    );
    expect(metadata.timeZone).toBeTruthy();
  });
});
