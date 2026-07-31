/**
 * @generated SignedSource<<200ec7ccc0694daefeb289301c0e49ac>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type AnnotationSource = "API" | "APP";
export type AnnotatorKind = "CODE" | "HUMAN" | "LLM";
export type PatchAnnotationInput = {
  annotationId: string;
  annotatorKind?: AnnotatorKind | null;
  explanation?: string | null;
  identifier?: string | null;
  label?: string | null;
  metadata?: any | null;
  name?: string | null;
  score?: number | null;
  source?: AnnotationSource | null;
};
export type SpanNotesListUpdateNoteMutation$variables = {
  input: PatchAnnotationInput;
  spanId: string;
};
export type SpanNotesListUpdateNoteMutation$data = {
  readonly patchSpanAnnotations: {
    readonly query: {
      readonly node: {
        readonly id?: string;
        readonly spanNotes?: ReadonlyArray<{
          readonly createdAt: string;
          readonly explanation: string | null;
          readonly id: string;
          readonly updatedAt: string;
          readonly user: {
            readonly profilePictureUrl: string | null;
            readonly username: string;
          } | null;
        }>;
      };
    };
  };
};
export type SpanNotesListUpdateNoteMutation = {
  response: SpanNotesListUpdateNoteMutation$data;
  variables: SpanNotesListUpdateNoteMutation$variables;
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
    "items": [
      {
        "kind": "Variable",
        "name": "input.0",
        "variableName": "input"
      }
    ],
    "kind": "ListValue",
    "name": "input"
  }
],
v2 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "spanId"
  }
],
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
  "name": "explanation",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "username",
  "storageKey": null
},
v8 = {
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
    "name": "SpanNotesListUpdateNoteMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "SpanAnnotationMutationPayload",
        "kind": "LinkedField",
        "name": "patchSpanAnnotations",
        "plural": false,
        "selections": [
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
                "args": (v2/*:: as any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v3/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "SpanAnnotation",
                        "kind": "LinkedField",
                        "name": "spanNotes",
                        "plural": true,
                        "selections": [
                          (v3/*:: as any*/),
                          (v4/*:: as any*/),
                          (v5/*:: as any*/),
                          (v6/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "User",
                            "kind": "LinkedField",
                            "name": "user",
                            "plural": false,
                            "selections": [
                              (v7/*:: as any*/),
                              (v8/*:: as any*/)
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "SpanNotesListUpdateNoteMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "SpanAnnotationMutationPayload",
        "kind": "LinkedField",
        "name": "patchSpanAnnotations",
        "plural": false,
        "selections": [
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
                "args": (v2/*:: as any*/),
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
                  (v3/*:: as any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "SpanAnnotation",
                        "kind": "LinkedField",
                        "name": "spanNotes",
                        "plural": true,
                        "selections": [
                          (v3/*:: as any*/),
                          (v4/*:: as any*/),
                          (v5/*:: as any*/),
                          (v6/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "User",
                            "kind": "LinkedField",
                            "name": "user",
                            "plural": false,
                            "selections": [
                              (v7/*:: as any*/),
                              (v8/*:: as any*/),
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
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "b6e7fd544a731e923d855562dd9cb99d",
    "id": null,
    "metadata": {},
    "name": "SpanNotesListUpdateNoteMutation",
    "operationKind": "mutation",
    "text": "mutation SpanNotesListUpdateNoteMutation(\n  $input: PatchAnnotationInput!\n  $spanId: ID!\n) {\n  patchSpanAnnotations(input: [$input]) {\n    query {\n      node(id: $spanId) {\n        __typename\n        ... on Span {\n          id\n          spanNotes {\n            id\n            explanation\n            createdAt\n            updatedAt\n            user {\n              username\n              profilePictureUrl\n              id\n            }\n          }\n        }\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "76d5f8fe36ccd0eaa76d050043eb38c4";

export default node;
