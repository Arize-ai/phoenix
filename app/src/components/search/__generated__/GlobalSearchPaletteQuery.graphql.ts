/**
 * @generated SignedSource<<668b09e7744cc2ced436f0897de841b0>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type GlobalSearchPaletteQuery$variables = {
  searchQuery: string;
};
export type GlobalSearchPaletteQuery$data = {
  readonly searchResources: ReadonlyArray<{
    readonly __typename: "Dataset";
    readonly description: string | null;
    readonly id: string;
    readonly name: string;
  } | {
    readonly __typename: "Experiment";
    readonly dataset: {
      readonly id: string;
    };
    readonly description: string | null;
    readonly id: string;
    readonly name: string;
  } | {
    readonly __typename: "Project";
    readonly description: string | null;
    readonly id: string;
    readonly name: string;
  } | {
    readonly __typename: "Prompt";
    readonly description: string | null;
    readonly id: string;
    readonly promptName: string;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  }>;
};
export type GlobalSearchPaletteQuery = {
  response: GlobalSearchPaletteQuery$data;
  variables: GlobalSearchPaletteQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "searchQuery"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "query",
    "variableName": "searchQuery"
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
  "name": "name",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v6 = [
  (v3/*: any*/),
  (v4/*: any*/),
  (v5/*: any*/)
],
v7 = {
  "kind": "InlineFragment",
  "selections": (v6/*: any*/),
  "type": "Project",
  "abstractKey": null
},
v8 = {
  "kind": "InlineFragment",
  "selections": (v6/*: any*/),
  "type": "Dataset",
  "abstractKey": null
},
v9 = [
  (v3/*: any*/)
],
v10 = {
  "kind": "InlineFragment",
  "selections": [
    (v3/*: any*/),
    (v4/*: any*/),
    (v5/*: any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "Dataset",
      "kind": "LinkedField",
      "name": "dataset",
      "plural": false,
      "selections": (v9/*: any*/),
      "storageKey": null
    }
  ],
  "type": "Experiment",
  "abstractKey": null
},
v11 = {
  "kind": "InlineFragment",
  "selections": [
    (v3/*: any*/),
    {
      "alias": "promptName",
      "args": null,
      "kind": "ScalarField",
      "name": "name",
      "storageKey": null
    },
    (v5/*: any*/)
  ],
  "type": "Prompt",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "GlobalSearchPaletteQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "searchResources",
        "plural": true,
        "selections": [
          (v2/*: any*/),
          (v7/*: any*/),
          (v8/*: any*/),
          (v10/*: any*/),
          (v11/*: any*/)
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
    "name": "GlobalSearchPaletteQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "searchResources",
        "plural": true,
        "selections": [
          (v2/*: any*/),
          (v7/*: any*/),
          (v8/*: any*/),
          (v10/*: any*/),
          (v11/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": (v9/*: any*/),
            "type": "Node",
            "abstractKey": "__isNode"
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "abd60605b97fd8dd0e627174759332db",
    "id": null,
    "metadata": {},
    "name": "GlobalSearchPaletteQuery",
    "operationKind": "query",
    "text": "query GlobalSearchPaletteQuery(\n  $searchQuery: String!\n) {\n  searchResources(query: $searchQuery) {\n    __typename\n    ... on Project {\n      id\n      name\n      description\n    }\n    ... on Dataset {\n      id\n      name\n      description\n    }\n    ... on Experiment {\n      id\n      name\n      description\n      dataset {\n        id\n      }\n    }\n    ... on Prompt {\n      id\n      promptName: name\n      description\n    }\n    ... on Node {\n      __isNode: __typename\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "141d8d75beb1ae54ec45c3d0369d99d9";

export default node;
