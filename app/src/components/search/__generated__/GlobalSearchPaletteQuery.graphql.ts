/**
 * @generated SignedSource<<d50a47adba2bb725a7eea6f4a19bf12b>>
 * @lightSyntaxTransform
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
  (v3/*:: as any*/),
  (v4/*:: as any*/),
  (v5/*:: as any*/)
],
v7 = {
  "kind": "InlineFragment",
  "selections": (v6/*:: as any*/),
  "type": "Project",
  "abstractKey": null
},
v8 = {
  "kind": "InlineFragment",
  "selections": (v6/*:: as any*/),
  "type": "Dataset",
  "abstractKey": null
},
v9 = [
  (v3/*:: as any*/)
],
v10 = {
  "kind": "InlineFragment",
  "selections": [
    (v3/*:: as any*/),
    (v4/*:: as any*/),
    (v5/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "Dataset",
      "kind": "LinkedField",
      "name": "dataset",
      "plural": false,
      "selections": (v9/*:: as any*/),
      "storageKey": null
    }
  ],
  "type": "Experiment",
  "abstractKey": null
},
v11 = {
  "kind": "InlineFragment",
  "selections": [
    (v3/*:: as any*/),
    {
      "alias": "promptName",
      "args": null,
      "kind": "ScalarField",
      "name": "name",
      "storageKey": null
    },
    (v5/*:: as any*/)
  ],
  "type": "Prompt",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "GlobalSearchPaletteQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "searchResources",
        "plural": true,
        "selections": [
          (v2/*:: as any*/),
          (v7/*:: as any*/),
          (v8/*:: as any*/),
          (v10/*:: as any*/),
          (v11/*:: as any*/)
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
    "name": "GlobalSearchPaletteQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "searchResources",
        "plural": true,
        "selections": [
          (v2/*:: as any*/),
          (v7/*:: as any*/),
          (v8/*:: as any*/),
          (v10/*:: as any*/),
          (v11/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": (v9/*:: as any*/),
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
