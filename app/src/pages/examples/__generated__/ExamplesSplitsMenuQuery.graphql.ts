/**
 * @generated SignedSource<<b437ff1c89d68734df890edddb98eaf1>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ExamplesSplitsMenuQuery$variables = Record<PropertyKey, never>;
export type ExamplesSplitsMenuQuery$data = {
  readonly datasetSplits: {
    readonly edges: ReadonlyArray<{
      readonly split: {
        readonly color: string;
        readonly id: string;
        readonly name: string;
      };
    }>;
  };
};
export type ExamplesSplitsMenuQuery = {
  response: ExamplesSplitsMenuQuery$data;
  variables: ExamplesSplitsMenuQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
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
            "alias": "split",
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
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "ExamplesSplitsMenuQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "ExamplesSplitsMenuQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "8d206c890376d9bb5a5309febf21454c",
    "id": null,
    "metadata": {},
    "name": "ExamplesSplitsMenuQuery",
    "operationKind": "query",
    "text": "query ExamplesSplitsMenuQuery {\n  datasetSplits {\n    edges {\n      split: node {\n        id\n        name\n        color\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "8622e1a40ea69edc970d9e2ab9a5e291";

export default node;
