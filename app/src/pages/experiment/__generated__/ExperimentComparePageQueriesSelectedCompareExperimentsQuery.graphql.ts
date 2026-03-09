/**
 * @generated SignedSource<<0a69ecf964a4e550468fcc08221692a0>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ExperimentComparePageQueriesSelectedCompareExperimentsQuery$variables = {
  datasetId: string;
  experimentIds: ReadonlyArray<string>;
};
export type ExperimentComparePageQueriesSelectedCompareExperimentsQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"ExperimentComparePage_selectedCompareExperiments">;
};
export type ExperimentComparePageQueriesSelectedCompareExperimentsQuery = {
  response: ExperimentComparePageQueriesSelectedCompareExperimentsQuery$data;
  variables: ExperimentComparePageQueriesSelectedCompareExperimentsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "datasetId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "experimentIds"
  }
],
v1 = {
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
    "name": "ExperimentComparePageQueriesSelectedCompareExperimentsQuery",
    "selections": [
      {
        "args": [
          {
            "kind": "Variable",
            "name": "datasetId",
            "variableName": "datasetId"
          },
          {
            "kind": "Variable",
            "name": "experimentIds",
            "variableName": "experimentIds"
          }
        ],
        "kind": "FragmentSpread",
        "name": "ExperimentComparePage_selectedCompareExperiments"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ExperimentComparePageQueriesSelectedCompareExperimentsQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": [
          {
            "kind": "Variable",
            "name": "id",
            "variableName": "datasetId"
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
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": [
                  {
                    "kind": "Variable",
                    "name": "filterIds",
                    "variableName": "experimentIds"
                  },
                  {
                    "kind": "Literal",
                    "name": "includeEphemeral",
                    "value": true
                  }
                ],
                "concreteType": "ExperimentConnection",
                "kind": "LinkedField",
                "name": "experiments",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ExperimentEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": "experiment",
                        "args": null,
                        "concreteType": "Experiment",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v1/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "sequenceNumber",
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
            ],
            "type": "Dataset",
            "abstractKey": null
          },
          (v1/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "7c15fa41768e4a97fd4af03e110f1d65",
    "id": null,
    "metadata": {},
    "name": "ExperimentComparePageQueriesSelectedCompareExperimentsQuery",
    "operationKind": "query",
    "text": "query ExperimentComparePageQueriesSelectedCompareExperimentsQuery(\n  $datasetId: ID!\n  $experimentIds: [ID!]!\n) {\n  ...ExperimentComparePage_selectedCompareExperiments_3xL6z4\n}\n\nfragment ExperimentComparePage_selectedCompareExperiments_3xL6z4 on Query {\n  dataset: node(id: $datasetId) {\n    __typename\n    ... on Dataset {\n      experiments(filterIds: $experimentIds, includeEphemeral: true) {\n        edges {\n          experiment: node {\n            id\n            sequenceNumber\n            name\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "27e79df0ed587748bcb0b0089a89bf47";

export default node;
