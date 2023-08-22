import { ISpanItem } from "../types";
import { createSpanTree } from "../utils";

describe("createSpanTree", () => {
  const traceSpans: ISpanItem[] = [
    {
      spanKind: "chain",
      name: "query",
      statusCode: "OK",
      startTime: "2023-08-16T22:27:15.327378",
      latencyMs: 2275,
      parentId: null,
      context: {
        spanId: "86d5abea-ca78-4e59-a3f7-02548bb4e19a",
        traceId: "c399b6c1-2826-4e4c-90f4-068afccb81c2",
      },
    },
    {
      spanKind: "chain",
      name: "synthesize",
      statusCode: "OK",
      startTime: "2023-08-16T22:27:15.679981",
      latencyMs: 1923,
      parentId: "86d5abea-ca78-4e59-a3f7-02548bb4e19a",
      context: {
        spanId: "6cd91cc2-c29d-45c9-b98b-dd37cffa1d7a",
        traceId: "c399b6c1-2826-4e4c-90f4-068afccb81c2",
      },
    },
    {
      spanKind: "llm",
      name: "llm",
      statusCode: "OK",
      startTime: "2023-08-16T22:27:15.681497",
      latencyMs: 1921,
      parentId: "6cd91cc2-c29d-45c9-b98b-dd37cffa1d7a",
      tokenCountTotal: null,
      context: {
        spanId: "5530a9fc-43d7-4add-bff9-91449ec0b1c3",
        traceId: "c399b6c1-2826-4e4c-90f4-068afccb81c2",
      },
    },
    {
      spanKind: "retriever",
      name: "retrieve",
      statusCode: "OK",
      startTime: "2023-08-16T22:27:15.327415",
      latencyMs: 352,
      parentId: "86d5abea-ca78-4e59-a3f7-02548bb4e19a",
      tokenCountTotal: null,
      context: {
        spanId: "de0d1e57-70d4-4b2b-a100-30b706902da3",
        traceId: "c399b6c1-2826-4e4c-90f4-068afccb81c2",
      },
    },
    {
      spanKind: "embedding",
      name: "embedding",
      statusCode: "OK",
      startTime: "2023-08-16T22:27:15.327439",
      latencyMs: 118,
      parentId: "de0d1e57-70d4-4b2b-a100-30b706902da3",
      context: {
        spanId: "86433110-f83a-429e-b6e9-5f23131d14f7",
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
                    "context": {
                      "spanId": "86433110-f83a-429e-b6e9-5f23131d14f7",
                      "traceId": "c399b6c1-2826-4e4c-90f4-068afccb81c2",
                    },
                    "latencyMs": 118,
                    "name": "embedding",
                    "parentId": "de0d1e57-70d4-4b2b-a100-30b706902da3",
                    "spanKind": "embedding",
                    "startTime": "2023-08-16T22:27:15.327439",
                    "statusCode": "OK",
                  },
                },
              ],
              "span": {
                "context": {
                  "spanId": "de0d1e57-70d4-4b2b-a100-30b706902da3",
                  "traceId": "c399b6c1-2826-4e4c-90f4-068afccb81c2",
                },
                "latencyMs": 352,
                "name": "retrieve",
                "parentId": "86d5abea-ca78-4e59-a3f7-02548bb4e19a",
                "spanKind": "retriever",
                "startTime": "2023-08-16T22:27:15.327415",
                "statusCode": "OK",
                "tokenCountTotal": null,
              },
            },
            {
              "children": [
                {
                  "children": [],
                  "span": {
                    "context": {
                      "spanId": "5530a9fc-43d7-4add-bff9-91449ec0b1c3",
                      "traceId": "c399b6c1-2826-4e4c-90f4-068afccb81c2",
                    },
                    "latencyMs": 1921,
                    "name": "llm",
                    "parentId": "6cd91cc2-c29d-45c9-b98b-dd37cffa1d7a",
                    "spanKind": "llm",
                    "startTime": "2023-08-16T22:27:15.681497",
                    "statusCode": "OK",
                    "tokenCountTotal": null,
                  },
                },
              ],
              "span": {
                "context": {
                  "spanId": "6cd91cc2-c29d-45c9-b98b-dd37cffa1d7a",
                  "traceId": "c399b6c1-2826-4e4c-90f4-068afccb81c2",
                },
                "latencyMs": 1923,
                "name": "synthesize",
                "parentId": "86d5abea-ca78-4e59-a3f7-02548bb4e19a",
                "spanKind": "chain",
                "startTime": "2023-08-16T22:27:15.679981",
                "statusCode": "OK",
              },
            },
          ],
          "span": {
            "context": {
              "spanId": "86d5abea-ca78-4e59-a3f7-02548bb4e19a",
              "traceId": "c399b6c1-2826-4e4c-90f4-068afccb81c2",
            },
            "latencyMs": 2275,
            "name": "query",
            "parentId": null,
            "spanKind": "chain",
            "startTime": "2023-08-16T22:27:15.327378",
            "statusCode": "OK",
          },
        },
      ]
    `);
  });
});
