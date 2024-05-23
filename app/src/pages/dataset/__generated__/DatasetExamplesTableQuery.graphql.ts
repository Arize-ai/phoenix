/**
 * @generated SignedSource<<3b1c053d4ae60fb43faceee69099a8dc>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DatasetExamplesTableQuery$variables = {
  id: string;
};
export type DatasetExamplesTableQuery$data = {
  readonly node: {
    readonly " $fragmentSpreads": FragmentRefs<"DatasetExamplesTableFragment">;
  };
};
export type DatasetExamplesTableQuery = {
  response: DatasetExamplesTableQuery$data;
  variables: DatasetExamplesTableQuery$variables;
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
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DatasetExamplesTableQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "DatasetExamplesTableFragment"
          }
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
    "name": "DatasetExamplesTableQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
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
            "kind": "TypeDiscriminator",
            "abstractKey": "__isNode"
          },
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "DatasetExampleConnection",
                "kind": "LinkedField",
                "name": "examples",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "DatasetExampleEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "DatasetExample",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v2/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "input",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "output",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "metadata",
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
            ],
            "type": "Dataset",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "dfb5b0e44679c2643b30d1657306a7ec",
    "id": null,
    "metadata": {},
    "name": "DatasetExamplesTableQuery",
    "operationKind": "query",
    "text": "query DatasetExamplesTableQuery(\n  $id: GlobalID!\n) {\n  node(id: $id) {\n    __typename\n    ...DatasetExamplesTableFragment\n    __isNode: __typename\n    id\n  }\n}\n\nfragment DatasetExamplesTableFragment on Dataset {\n  examples {\n    edges {\n      node {\n        id\n        input\n        output\n        metadata\n      }\n    }\n  }\n  id\n}\n"
  }
};
})();

(node as any).hash = "127b8480a49a6d5066e473810c0f8d04";

export default node;
