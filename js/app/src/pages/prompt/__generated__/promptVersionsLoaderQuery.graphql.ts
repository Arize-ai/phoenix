/**
 * @generated SignedSource<<98be2667eceb330c146bac4feb3e36d0>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type promptVersionsLoaderQuery$variables = {
  id: string;
};
export type promptVersionsLoaderQuery$data = {
  readonly prompt: {
    readonly __typename: "Decision";
    readonly latestVersion: {
      readonly id: string;
    } | null;
  } | {
    readonly __typename: "Prompt";
    readonly promptVersions: {
      readonly edges: ReadonlyArray<{
        readonly promptVersion: {
          readonly id: string;
        };
      }>;
    };
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type promptVersionsLoaderQuery = {
  response: promptVersionsLoaderQuery$data;
  variables: promptVersionsLoaderQuery$variables;
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
v4 = [
  (v3/*:: as any*/)
],
v5 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Literal",
          "name": "first",
          "value": 1
        }
      ],
      "concreteType": "PromptVersionConnection",
      "kind": "LinkedField",
      "name": "promptVersions",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "PromptVersionEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": "promptVersion",
              "args": null,
              "concreteType": "PromptVersion",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": (v4/*:: as any*/),
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": "promptVersions(first:1)"
    }
  ],
  "type": "Prompt",
  "abstractKey": null
},
v6 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": "latestVersion",
      "args": null,
      "concreteType": "DecisionVersion",
      "kind": "LinkedField",
      "name": "version",
      "plural": false,
      "selections": (v4/*:: as any*/),
      "storageKey": null
    }
  ],
  "type": "Decision",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "promptVersionsLoaderQuery",
    "selections": [
      {
        "alias": "prompt",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          (v5/*:: as any*/),
          (v6/*:: as any*/)
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
    "name": "promptVersionsLoaderQuery",
    "selections": [
      {
        "alias": "prompt",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          (v5/*:: as any*/),
          (v6/*:: as any*/),
          (v3/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "5410147c3a07da8c6d7076eacb4a5b51",
    "id": null,
    "metadata": {},
    "name": "promptVersionsLoaderQuery",
    "operationKind": "query",
    "text": "query promptVersionsLoaderQuery(\n  $id: ID!\n) {\n  prompt: node(id: $id) {\n    __typename\n    ... on Prompt {\n      promptVersions(first: 1) {\n        edges {\n          promptVersion: node {\n            id\n          }\n        }\n      }\n    }\n    ... on Decision {\n      latestVersion: version {\n        id\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "b44fe1735526a31596d2e72ce7ad8bd4";

export default node;
