/**
 * @generated SignedSource<<423a3c17f3b7eda625d8a732b4f5b6b9>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type RecentlyViewedTrackerNodeQuery$variables = {
  id: string;
};
export type RecentlyViewedTrackerNodeQuery$data = {
  readonly node: {
    readonly __typename: string;
    readonly id: string;
    readonly name?: string;
    readonly promptName?: string;
  };
};
export type RecentlyViewedTrackerNodeQuery = {
  response: RecentlyViewedTrackerNodeQuery$data;
  variables: RecentlyViewedTrackerNodeQuery$variables;
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
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "name",
    "storageKey": null
  }
],
v2 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "id",
        "variableName": "id"
      }
    ],
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
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "id",
        "storageKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": (v1/*: any*/),
        "type": "Project",
        "abstractKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": (v1/*: any*/),
        "type": "Dataset",
        "abstractKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": (v1/*: any*/),
        "type": "Experiment",
        "abstractKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": [
          {
            "alias": "promptName",
            "args": null,
            "kind": "ScalarField",
            "name": "name",
            "storageKey": null
          }
        ],
        "type": "Prompt",
        "abstractKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "RecentlyViewedTrackerNodeQuery",
    "selections": (v2/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "RecentlyViewedTrackerNodeQuery",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "cd6df96fb9f51e7036fae0fcc51d1988",
    "id": null,
    "metadata": {},
    "name": "RecentlyViewedTrackerNodeQuery",
    "operationKind": "query",
    "text": "query RecentlyViewedTrackerNodeQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    id\n    ... on Project {\n      name\n    }\n    ... on Dataset {\n      name\n    }\n    ... on Experiment {\n      name\n    }\n    ... on Prompt {\n      promptName: name\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "6f303d77a3726864c26bfe9f8a981d7b";

export default node;
