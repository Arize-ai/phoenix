import { formatQueueCount } from "../evaluationQueueCounts";

describe("formatQueueCount", () => {
  it("shows a count at the server's limit as at least the limit", () => {
    expect(formatQueueCount(999_999)).toBe("999,999");
    expect(formatQueueCount(1_000_000)).toBe("1,000,000+");
  });
});
