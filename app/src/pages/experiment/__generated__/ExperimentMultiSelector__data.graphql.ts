/**
 * @generated SignedSource<<c919c0a94e1279bb2ee28a5c25af531b>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ExperimentMultiSelector__data$data = {
  readonly baseExperiment?: {
    readonly id?: string;
    readonly isBaseline?: boolean;
    readonly name?: string;
  };
  readonly dataset: {
    readonly allExperiments?: {
      readonly edges: ReadonlyArray<{
        readonly experiment: {
          readonly createdAt: string;
          readonly id: string;
          readonly isBaseline: boolean;
          readonly name: string;
          readonly sequenceNumber: number;
        };
      }>;
    };
    readonly id: string;
    readonly name?: string;
  };
  readonly " $fragmentType": "ExperimentMultiSelector__data";
};
export type ExperimentMultiSelector__data$key = {
  readonly " $data"?: ExperimentMultiSelector__data$data;
  readonly " $fragmentSpreads": FragmentRefs<"ExperimentMultiSelector__data">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "isBaseline",
  "storageKey": null
};
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "baseExperimentId"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "datasetId"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "hasBaseExperiment"
    }
  ],
  "kind": "Fragment",
  "metadata": null,
  "name": "ExperimentMultiSelector__data",
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
        (v0/*:: as any*/),
        {
          "kind": "InlineFragment",
          "selections": [
            (v1/*:: as any*/),
            {
              "alias": "allExperiments",
              "args": null,
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
                        (v0/*:: as any*/),
                        (v1/*:: as any*/),
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "sequenceNumber",
                          "storageKey": null
                        },
                        (v2/*:: as any*/),
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "createdAt",
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
    },
    {
      "condition": "hasBaseExperiment",
      "kind": "Condition",
      "passingValue": true,
      "selections": [
        {
          "alias": "baseExperiment",
          "args": [
            {
              "kind": "Variable",
              "name": "id",
              "variableName": "baseExperimentId"
            }
          ],
          "concreteType": null,
          "kind": "LinkedField",
          "name": "node",
          "plural": false,
          "selections": [
            {
              "kind": "InlineFragment",
              "selections": [
                (v0/*:: as any*/),
                (v1/*:: as any*/),
                (v2/*:: as any*/)
              ],
              "type": "Experiment",
              "abstractKey": null
            }
          ],
          "storageKey": null
        }
      ]
    }
  ],
  "type": "Query",
  "abstractKey": null
};
})();

(node as any).hash = "d537abb866a0b9218efdb7c5e1e2393c";

export default node;
