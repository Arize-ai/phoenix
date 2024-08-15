/**
 * @generated SignedSource<<15286f0446f997087c2392d071de7a69>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type MimeType = "json" | "text";
export type SpanKind = "agent" | "chain" | "embedding" | "evaluator" | "guardrail" | "llm" | "reranker" | "retriever" | "tool" | "unknown";
export type SpanStatusCode = "ERROR" | "OK" | "UNSET";
export type SpanDetailsQuery$variables = {
  spanId: string;
};
export type SpanDetailsQuery$data = {
  readonly span: {
    readonly __typename: "Span";
    readonly attributes: string;
    readonly context: {
      readonly spanId: string;
      readonly traceId: string;
    };
    readonly documentEvaluations: ReadonlyArray<{
      readonly documentPosition: number;
      readonly explanation: string | null;
      readonly label: string | null;
      readonly name: string;
      readonly score: number | null;
    }>;
    readonly documentRetrievalMetrics: ReadonlyArray<{
      readonly evaluationName: string;
      readonly hit: number | null;
      readonly ndcg: number | null;
      readonly precision: number | null;
    }>;
    readonly events: ReadonlyArray<{
      readonly message: string;
      readonly name: string;
      readonly timestamp: string;
    }>;
    readonly id: string;
    readonly input: {
      readonly mimeType: MimeType;
      readonly value: string;
    } | null;
    readonly latencyMs: number | null;
    readonly name: string;
    readonly output: {
      readonly mimeType: MimeType;
      readonly value: string;
    } | null;
    readonly parentId: string | null;
    readonly spanAnnotations: ReadonlyArray<{
      readonly name: string;
    }>;
    readonly spanKind: SpanKind;
    readonly startTime: string;
    readonly statusCode: SpanStatusCode;
    readonly statusMessage: string;
    readonly tokenCountCompletion: number | null;
    readonly tokenCountPrompt: number | null;
    readonly tokenCountTotal: number | null;
    readonly " $fragmentSpreads": FragmentRefs<"SpanAside_span" | "SpanFeedback_annotations">;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type SpanDetailsQuery = {
  response: SpanDetailsQuery$data;
  variables: SpanDetailsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "spanId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "spanId"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanContext",
  "kind": "LinkedField",
  "name": "context",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "spanId",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "traceId",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "spanKind",
  "storageKey": null
},
v7 = {
  "alias": "statusCode",
  "args": null,
  "kind": "ScalarField",
  "name": "propagatedStatusCode",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "statusMessage",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "startTime",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "parentId",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "latencyMs",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "tokenCountTotal",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "tokenCountPrompt",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "tokenCountCompletion",
  "storageKey": null
},
v15 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "value",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "mimeType",
    "storageKey": null
  }
],
v16 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanIOValue",
  "kind": "LinkedField",
  "name": "input",
  "plural": false,
  "selections": (v15/*: any*/),
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanIOValue",
  "kind": "LinkedField",
  "name": "output",
  "plural": false,
  "selections": (v15/*: any*/),
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "attributes",
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanEvent",
  "kind": "LinkedField",
  "name": "events",
  "plural": true,
  "selections": [
    (v5/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "message",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "timestamp",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v20 = {
  "alias": null,
  "args": null,
  "concreteType": "DocumentRetrievalMetrics",
  "kind": "LinkedField",
  "name": "documentRetrievalMetrics",
  "plural": true,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "evaluationName",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "ndcg",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "precision",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "hit",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v21 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v22 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
},
v23 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "explanation",
  "storageKey": null
},
v24 = {
  "alias": null,
  "args": null,
  "concreteType": "DocumentEvaluation",
  "kind": "LinkedField",
  "name": "documentEvaluations",
  "plural": true,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "documentPosition",
      "storageKey": null
    },
    (v5/*: any*/),
    (v21/*: any*/),
    (v22/*: any*/),
    (v23/*: any*/)
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SpanDetailsQuery",
    "selections": [
      {
        "alias": "span",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              (v9/*: any*/),
              (v10/*: any*/),
              (v11/*: any*/),
              (v12/*: any*/),
              (v13/*: any*/),
              (v14/*: any*/),
              (v16/*: any*/),
              (v17/*: any*/),
              (v18/*: any*/),
              {
                "kind": "RequiredField",
                "field": (v19/*: any*/),
                "action": "THROW",
                "path": "span.events"
              },
              (v20/*: any*/),
              (v24/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "SpanAnnotation",
                "kind": "LinkedField",
                "name": "spanAnnotations",
                "plural": true,
                "selections": [
                  (v5/*: any*/)
                ],
                "storageKey": null
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "SpanFeedback_annotations"
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "SpanAside_span"
              }
            ],
            "type": "Span",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SpanDetailsQuery",
    "selections": [
      {
        "alias": "span",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          {
            "kind": "TypeDiscriminator",
            "abstractKey": "__isNode"
          },
          (v3/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v7/*: any*/),
              (v8/*: any*/),
              (v9/*: any*/),
              (v10/*: any*/),
              (v11/*: any*/),
              (v12/*: any*/),
              (v13/*: any*/),
              (v14/*: any*/),
              (v16/*: any*/),
              (v17/*: any*/),
              (v18/*: any*/),
              (v19/*: any*/),
              (v20/*: any*/),
              (v24/*: any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "SpanAnnotation",
                "kind": "LinkedField",
                "name": "spanAnnotations",
                "plural": true,
                "selections": [
                  (v5/*: any*/),
                  (v21/*: any*/),
                  (v22/*: any*/),
                  (v23/*: any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "annotatorKind",
                    "storageKey": null
                  },
                  (v3/*: any*/)
                ],
                "storageKey": null
              },
              {
                "alias": "code",
                "args": null,
                "kind": "ScalarField",
                "name": "statusCode",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "endTime",
                "storageKey": null
              }
            ],
            "type": "Span",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "b1a80a0108c40baebf6e64b811ca0202",
    "id": null,
    "metadata": {},
    "name": "SpanDetailsQuery",
    "operationKind": "query",
    "text": "query SpanDetailsQuery(\n  $spanId: GlobalID!\n) {\n  span: node(id: $spanId) {\n    __typename\n    ... on Span {\n      id\n      context {\n        spanId\n        traceId\n      }\n      name\n      spanKind\n      statusCode: propagatedStatusCode\n      statusMessage\n      startTime\n      parentId\n      latencyMs\n      tokenCountTotal\n      tokenCountPrompt\n      tokenCountCompletion\n      input {\n        value\n        mimeType\n      }\n      output {\n        value\n        mimeType\n      }\n      attributes\n      events {\n        name\n        message\n        timestamp\n      }\n      documentRetrievalMetrics {\n        evaluationName\n        ndcg\n        precision\n        hit\n      }\n      documentEvaluations {\n        documentPosition\n        name\n        label\n        score\n        explanation\n      }\n      spanAnnotations {\n        name\n      }\n      ...SpanFeedback_annotations\n      ...SpanAside_span\n    }\n    __isNode: __typename\n    id\n  }\n}\n\nfragment SpanAside_span on Span {\n  id\n  code: statusCode\n  startTime\n  endTime\n  tokenCountTotal\n  tokenCountPrompt\n  tokenCountCompletion\n  spanAnnotations {\n    id\n    name\n    label\n    annotatorKind\n    score\n  }\n}\n\nfragment SpanFeedback_annotations on Span {\n  spanAnnotations {\n    name\n    label\n    score\n    explanation\n    annotatorKind\n  }\n}\n"
  }
};
})();

(node as any).hash = "eaf52d9b37b1f5a29cae360a05b7c975";

export default node;
