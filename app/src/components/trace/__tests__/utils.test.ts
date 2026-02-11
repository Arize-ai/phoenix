import { ISpanItem } from "../types";
import { compareTimestamps, createSpanTree } from "../utils";

describe("compareTimestamps", () => {
  it("correctly orders timestamps with sub-millisecond precision", () => {
    const earlier = "2024-01-15T10:30:00.123456Z";
    const later = "2024-01-15T10:30:00.123789Z";

    expect(compareTimestamps(earlier, later)).toBe(-1);
    expect(compareTimestamps(later, earlier)).toBe(1);
    expect(compareTimestamps(earlier, earlier)).toBe(0);
  });

  it("correctly compares timestamps with different timezone offsets", () => {
    // These represent the same instant
    const utc = "2024-01-15T05:30:00.123456Z";
    const plusFive = "2024-01-15T10:30:00.123456+05:00";

    expect(compareTimestamps(utc, plusFive)).toBe(0);

    // This is 333 microseconds later
    const laterUtc = "2024-01-15T05:30:00.123789Z";
    expect(compareTimestamps(plusFive, laterUtc)).toBe(-1);
  });

  it("correctly compares timestamps with different fractional second precision", () => {
    // This test addresses the lexicographic comparison bug where .123Z would
    // incorrectly sort after .123456Z because 'Z' (ASCII 90) > '4' (ASCII 52)
    const millisecondPrecision = "2024-01-15T10:30:00.123Z";
    const microsecondPrecision = "2024-01-15T10:30:00.123456Z";

    // .123 seconds (123ms) should come before .123456 seconds (123.456ms)
    expect(compareTimestamps(millisecondPrecision, microsecondPrecision)).toBe(
      -1
    );
    expect(compareTimestamps(microsecondPrecision, millisecondPrecision)).toBe(
      1
    );

    // Edge case: same milliseconds but different microseconds
    const sameMs1 = "2024-01-15T10:30:00.123Z";
    const sameMs2 = "2024-01-15T10:30:00.123000Z";
    expect(compareTimestamps(sameMs1, sameMs2)).toBe(0);
  });
});

describe("createSpanTree", () => {
  const traceSpans: ISpanItem[] = [
    {
      id: "1",
      spanKind: "chain",
      name: "query",
      statusCode: "OK",
      startTime: "2023-08-16T22:27:15.327378",
      endTime: "2023-08-16T22:27:15.327378",
      latencyMs: 2275,
      parentId: null,
      spanId: "86d5abea-ca78-4e59-a3f7-02548bb4e19a",
      trace: {
        traceId: "c399b6c1-2826-4e4c-90f4-068afccb81c2",
      },
    },
    {
      id: "2",
      spanKind: "chain",
      name: "synthesize",
      statusCode: "OK",
      startTime: "2023-08-16T22:27:15.679981",
      endTime: "2023-08-16T22:27:15.327378",
      latencyMs: 1923,
      parentId: "86d5abea-ca78-4e59-a3f7-02548bb4e19a",
      spanId: "6cd91cc2-c29d-45c9-b98b-dd37cffa1d7a",
      trace: {
        traceId: "c399b6c1-2826-4e4c-90f4-068afccb81c2",
      },
    },
    {
      id: "3",
      spanKind: "llm",
      name: "llm",
      statusCode: "OK",
      startTime: "2023-08-16T22:27:15.681497",
      endTime: "2023-08-16T22:27:15.681497",
      latencyMs: 1921,
      parentId: "6cd91cc2-c29d-45c9-b98b-dd37cffa1d7a",
      tokenCountTotal: null,
      spanId: "5530a9fc-43d7-4add-bff9-91449ec0b1c3",
      trace: {
        traceId: "c399b6c1-2826-4e4c-90f4-068afccb81c2",
      },
    },
    {
      id: "4",
      spanKind: "retriever",
      name: "retrieve",
      statusCode: "OK",
      startTime: "2023-08-16T22:27:15.327415",
      endTime: "2023-08-16T22:27:15.327415",
      latencyMs: 352,
      parentId: "86d5abea-ca78-4e59-a3f7-02548bb4e19a",
      tokenCountTotal: null,
      spanId: "de0d1e57-70d4-4b2b-a100-30b706902da3",
      trace: {
        traceId: "c399b6c1-2826-4e4c-90f4-068afccb81c2",
      },
    },
    {
      id: "5",
      spanKind: "embedding",
      name: "embedding",
      statusCode: "OK",
      startTime: "2023-08-16T22:27:15.327439",
      endTime: "2023-08-16T22:27:15.327439",
      latencyMs: 118,
      parentId: "de0d1e57-70d4-4b2b-a100-30b706902da3",
      spanId: "86433110-f83a-429e-b6e9-5f23131d14f7",
      trace: {
        traceId: "c399b6c1-2826-4e4c-90f4-068afccb81c2",
      },
    },
  ];
  it("should create a span tree", () => {
    expect(createSpanTree(traceSpans)).toMatchInlineSnapshot(`
      [
        {
          "children": [
            {
              "children": [
                {
                  "children": [],
                  "span": {
                    "endTime": "2023-08-16T22:27:15.327439",
                    "id": "5",
                    "latencyMs": 118,
                    "name": "embedding",
                    "parentId": "de0d1e57-70d4-4b2b-a100-30b706902da3",
                    "spanId": "86433110-f83a-429e-b6e9-5f23131d14f7",
                    "spanKind": "embedding",
                    "startTime": "2023-08-16T22:27:15.327439",
                    "statusCode": "OK",
                    "trace": {
                      "traceId": "c399b6c1-2826-4e4c-90f4-068afccb81c2",
                    },
                  },
                },
              ],
              "span": {
                "endTime": "2023-08-16T22:27:15.327415",
                "id": "4",
                "latencyMs": 352,
                "name": "retrieve",
                "parentId": "86d5abea-ca78-4e59-a3f7-02548bb4e19a",
                "spanId": "de0d1e57-70d4-4b2b-a100-30b706902da3",
                "spanKind": "retriever",
                "startTime": "2023-08-16T22:27:15.327415",
                "statusCode": "OK",
                "tokenCountTotal": null,
                "trace": {
                  "traceId": "c399b6c1-2826-4e4c-90f4-068afccb81c2",
                },
              },
            },
            {
              "children": [
                {
                  "children": [],
                  "span": {
                    "endTime": "2023-08-16T22:27:15.681497",
                    "id": "3",
                    "latencyMs": 1921,
                    "name": "llm",
                    "parentId": "6cd91cc2-c29d-45c9-b98b-dd37cffa1d7a",
                    "spanId": "5530a9fc-43d7-4add-bff9-91449ec0b1c3",
                    "spanKind": "llm",
                    "startTime": "2023-08-16T22:27:15.681497",
                    "statusCode": "OK",
                    "tokenCountTotal": null,
                    "trace": {
                      "traceId": "c399b6c1-2826-4e4c-90f4-068afccb81c2",
                    },
                  },
                },
              ],
              "span": {
                "endTime": "2023-08-16T22:27:15.327378",
                "id": "2",
                "latencyMs": 1923,
                "name": "synthesize",
                "parentId": "86d5abea-ca78-4e59-a3f7-02548bb4e19a",
                "spanId": "6cd91cc2-c29d-45c9-b98b-dd37cffa1d7a",
                "spanKind": "chain",
                "startTime": "2023-08-16T22:27:15.679981",
                "statusCode": "OK",
                "trace": {
                  "traceId": "c399b6c1-2826-4e4c-90f4-068afccb81c2",
                },
              },
            },
          ],
          "span": {
            "endTime": "2023-08-16T22:27:15.327378",
            "id": "1",
            "latencyMs": 2275,
            "name": "query",
            "parentId": null,
            "spanId": "86d5abea-ca78-4e59-a3f7-02548bb4e19a",
            "spanKind": "chain",
            "startTime": "2023-08-16T22:27:15.327378",
            "statusCode": "OK",
            "trace": {
              "traceId": "c399b6c1-2826-4e4c-90f4-068afccb81c2",
            },
          },
        },
      ]
    `);
  });
});
