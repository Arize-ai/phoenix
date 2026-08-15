/**
 * @generated SignedSource<<13748c3104812695d90628d9e8d6fab0>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DatasetsPageQuery$variables = Record<PropertyKey, never>;
export type DatasetsPageQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"DatasetsTable_datasets">;
};
export type DatasetsPageQuery = {
  response: DatasetsPageQuery$data;
  variables: DatasetsPageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 100
  },
  {
    "kind": "Literal",
    "name": "sort",
    "value": {
      "col": "createdAt",
      "dir": "desc"
    }
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v3 = [
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
  },
  (v1/*:: as any*/)
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "DatasetsPageQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "DatasetsTable_datasets"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "DatasetsPageQuery",
    "selections": [
      {
        "alias": null,
        "args": (v0/*:: as any*/),
        "concreteType": "DatasetConnection",
        "kind": "LinkedField",
        "name": "datasets",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "DatasetEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "Dataset",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v1/*:: as any*/),
                  (v2/*:: as any*/),
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
                    "name": "metadata",
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
                    "name": "createdBy",
                    "plural": false,
                    "selections": (v3/*:: as any*/),
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "User",
                    "kind": "LinkedField",
                    "name": "updatedBy",
                    "plural": false,
                    "selections": (v3/*:: as any*/),
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "exampleCount",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "experimentCount",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "evaluatorCount",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "DatasetLabel",
                    "kind": "LinkedField",
                    "name": "labels",
                    "plural": true,
                    "selections": [
                      (v1/*:: as any*/),
                      (v2/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "color",
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "__typename",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "cursor",
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "PageInfo",
            "kind": "LinkedField",
            "name": "pageInfo",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "endCursor",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "hasNextPage",
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": "datasets(first:100,sort:{\"col\":\"createdAt\",\"dir\":\"desc\"})"
      },
      {
        "alias": null,
        "args": (v0/*:: as any*/),
        "filters": [
          "sort",
          "filter"
        ],
        "handle": "connection",
        "key": "DatasetsTable_datasets",
        "kind": "LinkedHandle",
        "name": "datasets"
      }
    ]
  },
  "params": {
    "cacheID": "76ce8f6ed8c949d48f69aa9e91a03437",
    "id": null,
    "metadata": {},
    "name": "DatasetsPageQuery",
    "operationKind": "query",
    "text": "query DatasetsPageQuery {\n  ...DatasetsTable_datasets\n}\n\nfragment DatasetsTable_datasets on Query {\n  datasets(first: 100, sort: {col: createdAt, dir: desc}) {\n    edges {\n      node {\n        id\n        name\n        description\n        metadata\n        createdAt\n        updatedAt\n        createdBy {\n          username\n          profilePictureUrl\n          id\n        }\n        updatedBy {\n          username\n          profilePictureUrl\n          id\n        }\n        exampleCount\n        experimentCount\n        evaluatorCount\n        labels {\n          id\n          name\n          color\n        }\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "985853a7939f44c0cefdd1a91472c67e";

export default node;
