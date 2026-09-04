/**
 * @generated SignedSource<<8d45d432c15780f289bc428c1e502465>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SettingsDatasetsPageQuery$variables = Record<PropertyKey, never>;
export type SettingsDatasetsPageQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"DatasetLabelsSettingsCardFragment">;
};
export type SettingsDatasetsPageQuery = {
  response: SettingsDatasetsPageQuery$data;
  variables: SettingsDatasetsPageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 100
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "SettingsDatasetsPageQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "DatasetLabelsSettingsCardFragment"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "SettingsDatasetsPageQuery",
    "selections": [
      {
        "alias": null,
        "args": (v0/*:: as any*/),
        "concreteType": "DatasetLabelConnection",
        "kind": "LinkedField",
        "name": "datasetLabels",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "DatasetLabelEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "DatasetLabel",
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
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "usageCount",
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
        "storageKey": "datasetLabels(first:100)"
      },
      {
        "alias": null,
        "args": (v0/*:: as any*/),
        "filters": null,
        "handle": "connection",
        "key": "DatasetLabelsTable__datasetLabels",
        "kind": "LinkedHandle",
        "name": "datasetLabels"
      }
    ]
  },
  "params": {
    "cacheID": "2863524d62e5da3226a7403f2e731209",
    "id": null,
    "metadata": {},
    "name": "SettingsDatasetsPageQuery",
    "operationKind": "query",
    "text": "query SettingsDatasetsPageQuery {\n  ...DatasetLabelsSettingsCardFragment\n}\n\nfragment DatasetLabelsSettingsCardFragment on Query {\n  ...DatasetLabelsTableFragment\n}\n\nfragment DatasetLabelsTableFragment on Query {\n  datasetLabels(first: 100) {\n    edges {\n      node {\n        id\n        name\n        description\n        color\n        usageCount\n        __typename\n      }\n      cursor\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "5d2bdd09afe1ca6b4411604bf97e8f79";

export default node;
