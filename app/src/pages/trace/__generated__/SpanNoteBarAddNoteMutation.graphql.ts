/**
 * @generated SignedSource<<c6a023070c31b2307de7305da85fdfcb>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type CreateSpanNoteInput = {
  note: string;
  spanId: string;
};
export type SpanNoteBarAddNoteMutation$variables = {
  input: CreateSpanNoteInput;
  spanNodeId: string;
};
export type SpanNoteBarAddNoteMutation$data = {
  readonly createSpanNote: {
    readonly query: {
      readonly node: {
        readonly id?: string;
        readonly spanNotes?: ReadonlyArray<{
          readonly createdAt: string;
          readonly explanation: string | null;
          readonly id: string;
          readonly updatedAt: string;
          readonly user: {
            readonly id: string;
            readonly profilePictureUrl: string | null;
            readonly username: string;
          } | null;
        }>;
      };
    };
    readonly spanAnnotations: ReadonlyArray<{
      readonly id: string;
    }>;
  };
};
export type SpanNoteBarAddNoteMutation = {
  response: SpanNoteBarAddNoteMutation$data;
  variables: SpanNoteBarAddNoteMutation$variables;
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
    "name": "spanNodeId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "annotationInput",
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
  "concreteType": "SpanAnnotation",
  "kind": "LinkedField",
  "name": "spanAnnotations",
  "plural": true,
  "selections": [
    (v2/*:: as any*/)
  ],
  "storageKey": null
},
v4 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "spanNodeId"
  }
],
v5 = {
  "alias": null,
  "args": null,
  "concreteType": "SpanAnnotation",
  "kind": "LinkedField",
  "name": "spanNotes",
  "plural": true,
  "selections": [
    (v2/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "explanation",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "createdAt",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "updatedAt",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "User",
      "kind": "LinkedField",
      "name": "user",
      "plural": false,
      "selections": [
        (v2/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "username",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "profilePictureUrl",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SpanNoteBarAddNoteMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "SpanAnnotationMutationPayload",
        "kind": "LinkedField",
        "name": "createSpanNote",
        "plural": false,
        "selections": [
          (v3/*:: as any*/),
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
                "args": (v4/*:: as any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v2/*:: as any*/),
                      (v5/*:: as any*/)
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
    "name": "SpanNoteBarAddNoteMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "SpanAnnotationMutationPayload",
        "kind": "LinkedField",
        "name": "createSpanNote",
        "plural": false,
        "selections": [
          (v3/*:: as any*/),
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
                "args": (v4/*:: as any*/),
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
                  (v2/*:: as any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v5/*:: as any*/)
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
    "cacheID": "499a78174b1a8c19acf54e4a326385a9",
    "id": null,
    "metadata": {},
    "name": "SpanNoteBarAddNoteMutation",
    "operationKind": "mutation",
    "text": "mutation SpanNoteBarAddNoteMutation(\n  $input: CreateSpanNoteInput!\n  $spanNodeId: ID!\n) {\n  createSpanNote(annotationInput: $input) {\n    spanAnnotations {\n      id\n    }\n    query {\n      node(id: $spanNodeId) {\n        __typename\n        ... on Span {\n          id\n          spanNotes {\n            id\n            explanation\n            createdAt\n            updatedAt\n            user {\n              id\n              username\n              profilePictureUrl\n            }\n          }\n        }\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "8c27044dac8e7c14e04f570442ba3a71";

export default node;
