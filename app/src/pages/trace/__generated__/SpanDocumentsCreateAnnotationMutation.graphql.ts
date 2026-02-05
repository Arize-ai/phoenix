/**
 * @generated SignedSource<<509c7bd43da3359ad0c14eec8873ff9c>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AnnotationSource = "API" | "APP";
export type AnnotatorKind = "CODE" | "HUMAN" | "LLM";
export type CreateDocumentAnnotationInput = {
  annotatorKind: AnnotatorKind;
  documentPosition: number;
  explanation?: string | null;
  identifier?: string | null;
  label?: string | null;
  metadata?: any;
  name: string;
  score?: number | null;
  source: AnnotationSource;
  spanId: string;
};
export type SpanDocumentsCreateAnnotationMutation$variables = {
  input: ReadonlyArray<CreateDocumentAnnotationInput>;
  spanId: string;
};
export type SpanDocumentsCreateAnnotationMutation$data = {
  readonly createDocumentAnnotations: {
    readonly documentAnnotations: ReadonlyArray<{
      readonly documentPosition: number;
      readonly explanation: string | null;
      readonly id: string;
      readonly label: string | null;
      readonly name: string;
      readonly score: number | null;
    }>;
    readonly query: {
      readonly node: {
        readonly documentEvaluations?: ReadonlyArray<{
          readonly documentPosition: number;
          readonly explanation: string | null;
          readonly label: string | null;
          readonly name: string;
          readonly score: number | null;
        }>;
      };
    };
  };
};
export type SpanDocumentsCreateAnnotationMutation = {
  response: SpanDocumentsCreateAnnotationMutation$data;
  variables: SpanDocumentsCreateAnnotationMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "spanId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "documentPosition",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "explanation",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "concreteType": "DocumentAnnotation",
  "kind": "LinkedField",
  "name": "documentAnnotations",
  "plural": true,
  "selections": [
    (v2/*: any*/),
    (v3/*: any*/),
    (v4/*: any*/),
    (v5/*: any*/),
    (v6/*: any*/),
    (v7/*: any*/)
  ],
  "storageKey": null
},
v9 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "spanId"
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SpanDocumentsCreateAnnotationMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "DocumentAnnotationMutationPayload",
        "kind": "LinkedField",
        "name": "createDocumentAnnotations",
        "plural": false,
        "selections": [
          (v8/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": (v9/*: any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "DocumentAnnotation",
                        "kind": "LinkedField",
                        "name": "documentEvaluations",
                        "plural": true,
                        "selections": [
                          (v3/*: any*/),
                          (v4/*: any*/),
                          (v5/*: any*/),
                          (v6/*: any*/),
                          (v7/*: any*/)
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
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SpanDocumentsCreateAnnotationMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "DocumentAnnotationMutationPayload",
        "kind": "LinkedField",
        "name": "createDocumentAnnotations",
        "plural": false,
        "selections": [
          (v8/*: any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": (v9/*: any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "__typename",
                    "storageKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "DocumentAnnotation",
                        "kind": "LinkedField",
                        "name": "documentEvaluations",
                        "plural": true,
                        "selections": [
                          (v3/*: any*/),
                          (v4/*: any*/),
                          (v5/*: any*/),
                          (v6/*: any*/),
                          (v7/*: any*/),
                          (v2/*: any*/)
                        ],
                        "storageKey": null
                      }
                    ],
                    "type": "Span",
                    "abstractKey": null
                  },
                  (v2/*: any*/)
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "044c329c1289f54f032433b1c7e75d56",
    "id": null,
    "metadata": {},
    "name": "SpanDocumentsCreateAnnotationMutation",
    "operationKind": "mutation",
    "text": "mutation SpanDocumentsCreateAnnotationMutation(\n  $input: [CreateDocumentAnnotationInput!]!\n  $spanId: ID!\n) {\n  createDocumentAnnotations(input: $input) {\n    documentAnnotations {\n      id\n      documentPosition\n      name\n      label\n      score\n      explanation\n    }\n    query {\n      node(id: $spanId) {\n        __typename\n        ... on Span {\n          documentEvaluations {\n            documentPosition\n            name\n            label\n            score\n            explanation\n            id\n          }\n        }\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "b8ec089b97048e03099bf90374f94dda";

export default node;
