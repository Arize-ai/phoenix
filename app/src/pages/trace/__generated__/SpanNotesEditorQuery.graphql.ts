/**
 * @generated SignedSource<<f984f911db48fb2188036c243779e795>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SpanNotesEditorQuery$variables = {
  spanNodeId: string;
};
export type SpanNotesEditorQuery$data = {
  readonly span: {
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
  readonly viewer: {
    readonly id: string;
    readonly profilePictureUrl: string | null;
    readonly username: string;
  } | null;
};
export type SpanNotesEditorQuery = {
  response: SpanNotesEditorQuery$data;
  variables: SpanNotesEditorQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "spanNodeId"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = [
  (v1/*: any*/),
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
v3 = {
  "alias": null,
  "args": null,
  "concreteType": "User",
  "kind": "LinkedField",
  "name": "viewer",
  "plural": false,
  "selections": (v2/*: any*/),
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
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "SpanAnnotation",
      "kind": "LinkedField",
      "name": "spanAnnotations",
      "plural": true,
      "selections": [
        (v1/*: any*/),
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
          "selections": (v2/*: any*/),
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Span",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SpanNotesEditorQuery",
    "selections": [
      (v3/*: any*/),
      {
        "alias": "span",
        "args": (v4/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v5/*: any*/)
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
    "name": "SpanNotesEditorQuery",
    "selections": [
      (v3/*: any*/),
      {
        "alias": "span",
        "args": (v4/*: any*/),
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
          (v5/*: any*/),
          {
            "kind": "TypeDiscriminator",
            "abstractKey": "__isNode"
          },
          (v1/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "1c78ee04ea8e2b065d8903b04a1f6e54",
    "id": null,
    "metadata": {},
    "name": "SpanNotesEditorQuery",
    "operationKind": "query",
    "text": "query SpanNotesEditorQuery(\n  $spanNodeId: GlobalID!\n) {\n  viewer {\n    id\n    username\n    profilePictureUrl\n  }\n  span: node(id: $spanNodeId) {\n    __typename\n    ... on Span {\n      spanAnnotations {\n        id\n        name\n        explanation\n        createdAt\n        user {\n          id\n          username\n          profilePictureUrl\n        }\n      }\n    }\n    __isNode: __typename\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "4d324ba920dcf0a0cb24d624aea004ae";

export default node;
