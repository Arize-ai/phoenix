/**
 * @generated SignedSource<<a54f0a263ce1ffd02e60d02ede498258>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AnnotatorKind = "CODE" | "HUMAN" | "LLM";
export type MimeType = "json" | "text";
export type SpanKind = "agent" | "chain" | "embedding" | "evaluator" | "guardrail" | "llm" | "prompt" | "reranker" | "retriever" | "tool" | "unknown";
export type SpanDetailsContentQuery$variables = {
  id: string;
};
export type SpanDetailsContentQuery$data = {
  readonly span: {
    readonly __typename: "Span";
    readonly attributes: string;
    readonly documentEvaluations: ReadonlyArray<{
      readonly annotatorKind: AnnotatorKind;
      readonly createdAt: string;
      readonly documentPosition: number;
      readonly explanation: string | null;
      readonly id: string;
      readonly label: string | null;
      readonly name: string;
      readonly score: number | null;
      readonly updatedAt: string;
      readonly user: {
        readonly profilePictureUrl: string | null;
        readonly username: string;
      } | null;
    }>;
    readonly documentRetrievalMetrics: ReadonlyArray<{
      readonly evaluationName: string;
      readonly hit: number | null;
      readonly ndcg: number | null;
      readonly precision: number | null;
    }>;
    readonly events: ReadonlyArray<{
      readonly name: string;
    }>;
    readonly id: string;
    readonly input: {
      readonly mimeType: MimeType;
      readonly value: string;
    } | null;
    readonly output: {
      readonly mimeType: MimeType;
      readonly value: string;
    } | null;
    readonly spanId: string;
    readonly spanKind: SpanKind;
    readonly spanNotes: ReadonlyArray<{
      readonly id: string;
    }>;
    readonly statusMessage: string;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type SpanDetailsContentQuery = {
  response: SpanDetailsContentQuery$data;
  variables: SpanDetailsContentQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
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
  "kind": "ScalarField",
  "name": "spanId",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "spanKind",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "statusMessage",
  "storageKey": null
},
v7 = [
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
v8 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanIOValue",
  "kind": "LinkedField",
  "name": "input",
  "plural": false,
  "selections": (v7/*:: as any*/),
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanIOValue",
  "kind": "LinkedField",
  "name": "output",
  "plural": false,
  "selections": (v7/*:: as any*/),
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "attributes",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanEvent",
  "kind": "LinkedField",
  "name": "events",
  "plural": true,
  "selections": [
    (v11/*:: as any*/)
  ],
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanAnnotation",
  "kind": "LinkedField",
  "name": "spanNotes",
  "plural": true,
  "selections": [
    (v3/*:: as any*/)
  ],
  "storageKey": null
},
v14 = {
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
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "annotatorKind",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "documentPosition",
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "explanation",
  "storageKey": null
},
v20 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v21 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
},
v22 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "username",
  "storageKey": null
},
v23 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "profilePictureUrl",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SpanDetailsContentQuery",
    "selections": [
      {
        "alias": "span",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*:: as any*/),
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              (v6/*:: as any*/),
              (v8/*:: as any*/),
              (v9/*:: as any*/),
              (v10/*:: as any*/),
              {
                "kind": "RequiredField",
                "field": (v12/*:: as any*/),
                "action": "THROW"
              },
              (v13/*:: as any*/),
              (v14/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "DocumentAnnotation",
                "kind": "LinkedField",
                "name": "documentEvaluations",
                "plural": true,
                "selections": [
                  (v3/*:: as any*/),
                  (v15/*:: as any*/),
                  (v16/*:: as any*/),
                  (v11/*:: as any*/),
                  (v17/*:: as any*/),
                  (v18/*:: as any*/),
                  (v19/*:: as any*/),
                  (v20/*:: as any*/),
                  (v21/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "User",
                    "kind": "LinkedField",
                    "name": "user",
                    "plural": false,
                    "selections": [
                      (v22/*:: as any*/),
                      (v23/*:: as any*/)
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "SpanDetailsContentQuery",
    "selections": [
      {
        "alias": "span",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          (v3/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              (v6/*:: as any*/),
              (v8/*:: as any*/),
              (v9/*:: as any*/),
              (v10/*:: as any*/),
              (v12/*:: as any*/),
              (v13/*:: as any*/),
              (v14/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "DocumentAnnotation",
                "kind": "LinkedField",
                "name": "documentEvaluations",
                "plural": true,
                "selections": [
                  (v3/*:: as any*/),
                  (v15/*:: as any*/),
                  (v16/*:: as any*/),
                  (v11/*:: as any*/),
                  (v17/*:: as any*/),
                  (v18/*:: as any*/),
                  (v19/*:: as any*/),
                  (v20/*:: as any*/),
                  (v21/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "User",
                    "kind": "LinkedField",
                    "name": "user",
                    "plural": false,
                    "selections": [
                      (v22/*:: as any*/),
                      (v23/*:: as any*/),
                      (v3/*:: as any*/)
                    ],
                    "storageKey": null
                  }
                ],
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
    "cacheID": "4579195acc8b0d49846f664e0ec9df86",
    "id": null,
    "metadata": {},
    "name": "SpanDetailsContentQuery",
    "operationKind": "query",
    "text": "query SpanDetailsContentQuery(\n  $id: ID!\n) {\n  span: node(id: $id) {\n    __typename\n    ... on Span {\n      id\n      spanId\n      spanKind\n      statusMessage\n      input {\n        value\n        mimeType\n      }\n      output {\n        value\n        mimeType\n      }\n      attributes\n      events {\n        name\n      }\n      spanNotes {\n        id\n      }\n      documentRetrievalMetrics {\n        evaluationName\n        ndcg\n        precision\n        hit\n      }\n      documentEvaluations {\n        id\n        annotatorKind\n        documentPosition\n        name\n        label\n        score\n        explanation\n        createdAt\n        updatedAt\n        user {\n          username\n          profilePictureUrl\n          id\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "9eda0408276e9400977dddcdbac5e025";

export default node;
