/**
 * @generated SignedSource<<976710b1f330526ccbd8e3d895a35ca7>>
 * @lightSyntaxTransform
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
    readonly description?: string | null;
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
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v2 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "name",
    "storageKey": null
  },
  (v1/*:: as any*/)
],
v3 = [
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
        "selections": (v2/*:: as any*/),
        "type": "Project",
        "abstractKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": (v2/*:: as any*/),
        "type": "Dataset",
        "abstractKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": (v2/*:: as any*/),
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
          },
          (v1/*:: as any*/)
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "RecentlyViewedTrackerNodeQuery",
    "selections": (v3/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "RecentlyViewedTrackerNodeQuery",
    "selections": (v3/*:: as any*/)
  },
  "params": {
    "cacheID": "ba52f1cdbfb96c516dadf1e2710d1d90",
    "id": null,
    "metadata": {},
    "name": "RecentlyViewedTrackerNodeQuery",
    "operationKind": "query",
    "text": "query RecentlyViewedTrackerNodeQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    id\n    ... on Project {\n      name\n      description\n    }\n    ... on Dataset {\n      name\n      description\n    }\n    ... on Experiment {\n      name\n      description\n    }\n    ... on Prompt {\n      promptName: name\n      description\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "0467eab28982d171751e239c16de6ef6";

export default node;
