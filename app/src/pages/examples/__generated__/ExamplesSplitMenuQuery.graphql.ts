/**
 * @generated SignedSource<<cb704ee27330035ff5df62885f0be196>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ExamplesSplitMenuQuery$variables = Record<PropertyKey, never>;
export type ExamplesSplitMenuQuery$data = {
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
export type ExamplesSplitMenuQuery = {
  response: ExamplesSplitMenuQuery$data;
  variables: ExamplesSplitMenuQuery$variables;
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
    "name": "ExamplesSplitMenuQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "ExamplesSplitMenuQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "528039e9625c395b9721acbe60ff7a24",
    "id": null,
    "metadata": {},
    "name": "ExamplesSplitMenuQuery",
    "operationKind": "query",
    "text": "query ExamplesSplitMenuQuery {\n  datasetSplits {\n    edges {\n      split: node {\n        id\n        name\n        color\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "8154a68a8e77401911b3171986fc1a56";

export default node;
