/**
 * @generated SignedSource<<a897fb3a8d063d0cf249d4b2d8619339>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ExperimentCompareListPage_comparisons$data = {
  readonly experiment: {
    readonly runs?: {
      readonly edges: ReadonlyArray<{
        readonly run: {
          readonly annotations: {
            readonly edges: ReadonlyArray<{
              readonly annotation: {
                readonly label: string | null;
                readonly name: string;
                readonly score: number | null;
              };
            }>;
          };
          readonly costSummary: {
            readonly total: {
              readonly cost: number | null;
              readonly tokens: number | null;
            };
          };
          readonly endTime: string;
          readonly example: {
            readonly experiments: {
              readonly edges: ReadonlyArray<{
                readonly experiment: {
                  readonly id: string;
                  readonly runs: {
                    readonly edges: ReadonlyArray<{
                      readonly run: {
                        readonly annotations: {
                          readonly edges: ReadonlyArray<{
                            readonly annotation: {
                              readonly label: string | null;
                              readonly name: string;
                              readonly score: number | null;
                            };
                          }>;
                        };
                        readonly costSummary: {
                          readonly total: {
                            readonly cost: number | null;
                            readonly tokens: number | null;
                          };
                        };
                        readonly endTime: string;
                        readonly output: any | null;
                        readonly startTime: string;
                      };
                    }>;
                  };
                };
              }>;
            };
            readonly id: string;
            readonly revision: {
              readonly input: any;
              readonly referenceOutput: any;
            };
          };
          readonly id: string;
          readonly output: any | null;
          readonly startTime: string;
        };
      }>;
    };
  };
  readonly " $fragmentType": "ExperimentCompareListPage_comparisons";
};
export type ExperimentCompareListPage_comparisons$key = {
  readonly " $data"?: ExperimentCompareListPage_comparisons$data;
  readonly " $fragmentSpreads": FragmentRefs<"ExperimentCompareListPage_comparisons">;
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
  "name": "output",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "startTime",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "endTime",
  "storageKey": null
},
v4 = {
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
v5 = {
  "alias": null,
  "args": null,
  "concreteType": "ExperimentRunAnnotationConnection",
  "kind": "LinkedField",
  "name": "annotations",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "ExperimentRunAnnotationEdge",
      "kind": "LinkedField",
      "name": "edges",
      "plural": true,
      "selections": [
        {
          "alias": "annotation",
          "args": null,
          "concreteType": "ExperimentRunAnnotation",
          "kind": "LinkedField",
          "name": "node",
          "plural": false,
          "selections": [
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
              "name": "score",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "label",
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
      "name": "compareExperimentIds"
    }
  ],
  "kind": "Fragment",
  "metadata": null,
  "name": "ExperimentCompareListPage_comparisons",
  "selections": [
    {
      "alias": "experiment",
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
            {
              "alias": null,
              "args": [
                {
                  "kind": "Literal",
                  "name": "first",
                  "value": 50
                }
              ],
              "concreteType": "ExperimentRunConnection",
              "kind": "LinkedField",
              "name": "runs",
              "plural": false,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "ExperimentRunEdge",
                  "kind": "LinkedField",
                  "name": "edges",
                  "plural": true,
                  "selections": [
                    {
                      "alias": "run",
                      "args": null,
                      "concreteType": "ExperimentRun",
                      "kind": "LinkedField",
                      "name": "node",
                      "plural": false,
                      "selections": [
                        (v0/*: any*/),
                        (v1/*: any*/),
                        (v2/*: any*/),
                        (v3/*: any*/),
                        (v4/*: any*/),
                        (v5/*: any*/),
                        {
                          "alias": null,
                          "args": null,
                          "concreteType": "DatasetExample",
                          "kind": "LinkedField",
                          "name": "example",
                          "plural": false,
                          "selections": [
                            (v0/*: any*/),
                            {
                              "alias": null,
                              "args": null,
                              "concreteType": "DatasetExampleRevision",
                              "kind": "LinkedField",
                              "name": "revision",
                              "plural": false,
                              "selections": [
                                {
                                  "alias": null,
                                  "args": null,
                                  "kind": "ScalarField",
                                  "name": "input",
                                  "storageKey": null
                                },
                                {
                                  "alias": "referenceOutput",
                                  "args": null,
                                  "kind": "ScalarField",
                                  "name": "output",
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
                                  "name": "experimentIds",
                                  "variableName": "compareExperimentIds"
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
                                        (v0/*: any*/),
                                        {
                                          "alias": null,
                                          "args": [
                                            {
                                              "kind": "Literal",
                                              "name": "first",
                                              "value": 5
                                            }
                                          ],
                                          "concreteType": "ExperimentRunConnection",
                                          "kind": "LinkedField",
                                          "name": "runs",
                                          "plural": false,
                                          "selections": [
                                            {
                                              "alias": null,
                                              "args": null,
                                              "concreteType": "ExperimentRunEdge",
                                              "kind": "LinkedField",
                                              "name": "edges",
                                              "plural": true,
                                              "selections": [
                                                {
                                                  "alias": "run",
                                                  "args": null,
                                                  "concreteType": "ExperimentRun",
                                                  "kind": "LinkedField",
                                                  "name": "node",
                                                  "plural": false,
                                                  "selections": [
                                                    (v1/*: any*/),
                                                    (v2/*: any*/),
                                                    (v3/*: any*/),
                                                    (v4/*: any*/),
                                                    (v5/*: any*/)
                                                  ],
                                                  "storageKey": null
                                                }
                                              ],
                                              "storageKey": null
                                            }
                                          ],
                                          "storageKey": "runs(first:5)"
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
                      "storageKey": null
                    }
                  ],
                  "storageKey": null
                }
              ],
              "storageKey": "runs(first:50)"
            }
          ],
          "type": "Experiment",
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

(node as any).hash = "f0bc76162ab8b9950f6b397617cf7db6";

export default node;
