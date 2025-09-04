/**
 * @generated SignedSource<<7bcb9fe669b2eae6b51398af5cdd77ba>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type experimentCompareLoadery_datasetVersionQuery$variables = {
  baseExperimentId: string;
};
export type experimentCompareLoadery_datasetVersionQuery$data = {
  readonly baseExperiment: {
    readonly datasetVersionId?: string;
  };
};
export type experimentCompareLoadery_datasetVersionQuery = {
  response: experimentCompareLoadery_datasetVersionQuery$data;
  variables: experimentCompareLoadery_datasetVersionQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "baseExperimentId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "baseExperimentId"
  }
],
v2 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "datasetVersionId",
      "storageKey": null
    }
  ],
  "type": "Experiment",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "experimentCompareLoadery_datasetVersionQuery",
    "selections": [
      {
        "alias": "baseExperiment",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/)
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
    "name": "experimentCompareLoadery_datasetVersionQuery",
    "selections": [
      {
        "alias": "baseExperiment",
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
          (v2/*: any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "148932027de685f20f0246fff56e020b",
    "id": null,
    "metadata": {},
    "name": "experimentCompareLoadery_datasetVersionQuery",
    "operationKind": "query",
    "text": "query experimentCompareLoadery_datasetVersionQuery(\n  $baseExperimentId: ID!\n) {\n  baseExperiment: node(id: $baseExperimentId) {\n    __typename\n    ... on Experiment {\n      datasetVersionId\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "632d3d360eb289c133217bc5f0dbfc46";

export default node;
