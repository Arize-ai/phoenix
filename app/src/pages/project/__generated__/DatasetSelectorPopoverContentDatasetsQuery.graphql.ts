/**
 * @generated SignedSource<<195b37e17d517046389710991345ead5>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DatasetSelectorPopoverContentDatasetsQuery$variables = {
  search: string;
};
export type DatasetSelectorPopoverContentDatasetsQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"DatasetSelectorPopoverContent_datasets">;
};
export type DatasetSelectorPopoverContentDatasetsQuery = {
  response: DatasetSelectorPopoverContentDatasetsQuery$data;
  variables: DatasetSelectorPopoverContentDatasetsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "search"
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DatasetSelectorPopoverContentDatasetsQuery",
    "selections": [
      {
        "args": [
          {
            "kind": "Variable",
            "name": "search",
            "variableName": "search"
          }
        ],
        "kind": "FragmentSpread",
        "name": "DatasetSelectorPopoverContent_datasets"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "DatasetSelectorPopoverContentDatasetsQuery",
    "selections": [
      {
        "alias": null,
        "args": [
          {
            "fields": [
              {
                "kind": "Literal",
                "name": "col",
                "value": "name"
              },
              {
                "kind": "Variable",
                "name": "value",
                "variableName": "search"
              }
            ],
            "kind": "ObjectValue",
            "name": "filter"
          }
        ],
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
                "alias": "dataset",
                "args": null,
                "concreteType": "Dataset",
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
    ]
  },
  "params": {
    "cacheID": "01d8b191af606c33309651b7504ffbaf",
    "id": null,
    "metadata": {},
    "name": "DatasetSelectorPopoverContentDatasetsQuery",
    "operationKind": "query",
    "text": "query DatasetSelectorPopoverContentDatasetsQuery(\n  $search: String!\n) {\n  ...DatasetSelectorPopoverContent_datasets_40zwac\n}\n\nfragment DatasetSelectorPopoverContent_datasets_40zwac on Query {\n  datasets(filter: {col: name, value: $search}) {\n    edges {\n      dataset: node {\n        id\n        name\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "60d20faa9c3d4bbb03be15dec748af49";

export default node;
