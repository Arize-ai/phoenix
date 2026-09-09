/**
 * @generated SignedSource<<ad0a740fa7ccd748278f9f95149f3cd2>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type CreateSpanNoteInput = {
  identifier?: string | null;
  note: string;
  target: SpanIdentifierInput;
};
export type SpanIdentifierInput = {
  id: string;
  otelId?: never;
} | {
  id?: never;
  otelId: string;
};
export type SpanNoteBarAddNoteMutation$variables = {
  input: ReadonlyArray<CreateSpanNoteInput>;
  spanNodeId: string;
};
export type SpanNoteBarAddNoteMutation$data = {
  readonly createSpanNotes: {
    readonly query: {
      readonly node: {
        readonly id?: string;
        readonly spanAnnotations?: ReadonlyArray<{
          readonly createdAt: string;
          readonly explanation: string | null;
          readonly id: string;
          readonly name: string;
          readonly user: {
            readonly id: string;
            readonly profilePictureUrl: string | null;
            readonly username: string;
          } | null;
        }>;
      };
    };
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
    "name": "input",
    "variableName": "input"
  }
],
v2 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "spanNodeId"
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
  "concreteType": "SpanAnnotation",
  "kind": "LinkedField",
  "name": "spanAnnotations",
  "plural": true,
  "selections": [
    (v3/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "name",
      "storageKey": null
    },
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
      "concreteType": "User",
      "kind": "LinkedField",
      "name": "user",
      "plural": false,
      "selections": [
        (v3/*:: as any*/),
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
        "name": "createSpanNotes",
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
                      (v4/*:: as any*/)
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
        "name": "createSpanNotes",
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
                      (v4/*:: as any*/)
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
    "cacheID": "c02cd792f667e3d0cc52c3aa1ff0e9a0",
    "id": null,
    "metadata": {},
    "name": "SpanNoteBarAddNoteMutation",
    "operationKind": "mutation",
    "text": "mutation SpanNoteBarAddNoteMutation(\n  $input: [CreateSpanNoteInput!]!\n  $spanNodeId: ID!\n) {\n  createSpanNotes(input: $input) {\n    query {\n      node(id: $spanNodeId) {\n        __typename\n        ... on Span {\n          id\n          spanAnnotations {\n            id\n            name\n            explanation\n            createdAt\n            user {\n              id\n              username\n              profilePictureUrl\n            }\n          }\n        }\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "2d3faa06681fac4224fbf0f9eaa4da5f";

export default node;
