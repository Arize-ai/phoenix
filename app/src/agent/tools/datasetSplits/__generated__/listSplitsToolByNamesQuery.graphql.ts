/**
 * @generated SignedSource<<e8685380c7d0d5599da7f22099b95028>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type listSplitsToolByNamesQuery$variables = {
  first: number;
  names: ReadonlyArray<string>;
};
export type listSplitsToolByNamesQuery$data = {
  readonly datasetSplits: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly color: string;
        readonly description: string | null;
        readonly id: string;
        readonly name: string;
      };
    }>;
  };
};
export type listSplitsToolByNamesQuery = {
  response: listSplitsToolByNamesQuery$data;
  variables: listSplitsToolByNamesQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "first"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "names"
},
v2 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "first",
        "variableName": "first"
      },
      {
        "kind": "Variable",
        "name": "names",
        "variableName": "names"
      }
    ],
    "concreteType": "DatasetSplitConnection",
    "kind": "LinkedField",
    "name": "datasetSplits",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "DatasetSplitEdge",
        "kind": "LinkedField",
        "name": "edges",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "DatasetSplit",
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "id",
                "storageKey": null
              },
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
                "name": "description",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "color",
                "storageKey": null
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
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "listSplitsToolByNamesQuery",
    "selections": (v2/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "listSplitsToolByNamesQuery",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "7c75f6ba04def330811102fbc172b56b",
    "id": null,
    "metadata": {},
    "name": "listSplitsToolByNamesQuery",
    "operationKind": "query",
    "text": "query listSplitsToolByNamesQuery(\n  $names: [String!]!\n  $first: Int!\n) {\n  datasetSplits(names: $names, first: $first) {\n    edges {\n      node {\n        id\n        name\n        description\n        color\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "6a741f983ea0a826b2f124821e299ecc";

export default node;
