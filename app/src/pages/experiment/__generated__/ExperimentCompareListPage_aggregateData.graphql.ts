/**
 * @generated SignedSource<<c9f80a55dc15f1cf09f14af665745dc0>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ExperimentCompareListPage_aggregateData$data = {
  readonly dataset: {
    readonly experimentAnnotationSummaries?: ReadonlyArray<{
      readonly annotationName: string;
      readonly maxScore: number | null;
      readonly minScore: number | null;
    }>;
    readonly experiments?: {
      readonly edges: ReadonlyArray<{
        readonly experiment: {
          readonly annotationSummaries: ReadonlyArray<{
            readonly annotationName: string;
            readonly meanScore: number | null;
          }>;
          readonly averageRunLatencyMs: number | null;
          readonly costSummary: {
            readonly total: {
              readonly cost: number | null;
              readonly tokens: number | null;
            };
          };
          readonly id: string;
        };
      }>;
    };
  };
  readonly " $fragmentType": "ExperimentCompareListPage_aggregateData";
};
export type ExperimentCompareListPage_aggregateData$key = {
  readonly " $data"?: ExperimentCompareListPage_aggregateData$data;
  readonly " $fragmentSpreads": FragmentRefs<"ExperimentCompareListPage_aggregateData">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "annotationName",
  "storageKey": null
};
return {
  "argumentDefinitions": [
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
  "kind": "Fragment",
  "metadata": null,
  "name": "ExperimentCompareListPage_aggregateData",
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
          "kind": "InlineFragment",
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "DatasetExperimentAnnotationSummary",
              "kind": "LinkedField",
              "name": "experimentAnnotationSummaries",
              "plural": true,
              "selections": [
                (v0/*: any*/),
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "minScore",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "maxScore",
                  "storageKey": null
                }
              ],
              "storageKey": null
            },
            {
              "alias": null,
              "args": [
                {
                  "kind": "Variable",
                  "name": "filterIds",
                  "variableName": "experimentIds"
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
                          "name": "averageRunLatencyMs",
                          "storageKey": null
                        },
                        {
                          "alias": null,
                          "args": null,
                          "concreteType": "SpanCostSummary",
                          "kind": "LinkedField",
                          "name": "costSummary",
                          "plural": false,
                          "selections": [
                            {
                              "alias": null,
                              "args": null,
                              "concreteType": "CostBreakdown",
                              "kind": "LinkedField",
                              "name": "total",
                              "plural": false,
                              "selections": [
                                {
                                  "alias": null,
                                  "args": null,
                                  "kind": "ScalarField",
                                  "name": "tokens",
                                  "storageKey": null
                                },
                                {
                                  "alias": null,
                                  "args": null,
                                  "kind": "ScalarField",
                                  "name": "cost",
                                  "storageKey": null
                                }
                              ],
                              "storageKey": null
                            }
                          ],
                          "storageKey": null
                        },
                        {
                          "alias": null,
                          "args": null,
                          "concreteType": "ExperimentAnnotationSummary",
                          "kind": "LinkedField",
                          "name": "annotationSummaries",
                          "plural": true,
                          "selections": [
                            (v0/*: any*/),
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "meanScore",
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
              "storageKey": null
            }
          ],
          "type": "Dataset",
          "abstractKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};
})();

(node as any).hash = "936b49e6b7825e3d4373cfb03daf53b2";

export default node;
