/**
 * @generated SignedSource<<17b36daafcd4d3aaa80349988be837d9>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type DecisionAnnotationQuestionType = "CHOICE" | "PREDICATE" | "SCALE";
export type DecisionAnnotationStatus = "ANSWERED" | "ERROR" | "REFUSED";
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "META" | "MINIMAX" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "TYPESAFE" | "XAI" | "ZAI";
import { FragmentRefs } from "relay-runtime";
export type ExperimentCompareListPage_comparisons$data = {
  readonly experiment: {
    readonly id?: string;
    readonly runs?: {
      readonly edges: ReadonlyArray<{
        readonly run: {
          readonly annotations: {
            readonly edges: ReadonlyArray<{
              readonly annotation: {
                readonly decision: {
                  readonly answer: {
                    readonly __typename: "ChoiceAnswer";
                    readonly choice: string;
                    readonly choiceProbabilities: ReadonlyArray<{
                      readonly probability: number;
                      readonly value: string;
                    }>;
                    readonly confidence: number;
                  } | {
                    readonly __typename: "PredicateAnswer";
                    readonly probability: number;
                  } | {
                    readonly __typename: "ScaleAnswer";
                    readonly confidence: number;
                    readonly expectedLevel: number;
                    readonly levelProbabilities: ReadonlyArray<{
                      readonly level: number;
                      readonly probability: number;
                    }>;
                  } | {
                    // This will never be '%other', but we need some
                    // value in case none of the concrete values match.
                    readonly __typename: "%other";
                  } | null;
                  readonly modelProvider: GenerativeProviderKey | null;
                  readonly question: {
                    readonly choices: ReadonlyArray<{
                      readonly description: string | null;
                      readonly value: string;
                    }> | null;
                    readonly levels: ReadonlyArray<{
                      readonly description: string | null;
                      readonly label: string;
                    }> | null;
                    readonly name: string;
                    readonly type: DecisionAnnotationQuestionType;
                  } | null;
                  readonly requestedModel: string | null;
                  readonly resolvedModel: string | null;
                  readonly status: DecisionAnnotationStatus;
                } | null;
                readonly id: string;
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
            readonly experimentRepeatedRunGroups: ReadonlyArray<{
              readonly experimentId: string;
              readonly runs: ReadonlyArray<{
                readonly annotations: {
                  readonly edges: ReadonlyArray<{
                    readonly annotation: {
                      readonly decision: {
                        readonly answer: {
                          readonly __typename: "ChoiceAnswer";
                          readonly choice: string;
                          readonly choiceProbabilities: ReadonlyArray<{
                            readonly probability: number;
                            readonly value: string;
                          }>;
                          readonly confidence: number;
                        } | {
                          readonly __typename: "PredicateAnswer";
                          readonly probability: number;
                        } | {
                          readonly __typename: "ScaleAnswer";
                          readonly confidence: number;
                          readonly expectedLevel: number;
                          readonly levelProbabilities: ReadonlyArray<{
                            readonly level: number;
                            readonly probability: number;
                          }>;
                        } | {
                          // This will never be '%other', but we need some
                          // value in case none of the concrete values match.
                          readonly __typename: "%other";
                        } | null;
                        readonly modelProvider: GenerativeProviderKey | null;
                        readonly question: {
                          readonly choices: ReadonlyArray<{
                            readonly description: string | null;
                            readonly value: string;
                          }> | null;
                          readonly levels: ReadonlyArray<{
                            readonly description: string | null;
                            readonly label: string;
                          }> | null;
                          readonly name: string;
                          readonly type: DecisionAnnotationQuestionType;
                        } | null;
                        readonly requestedModel: string | null;
                        readonly resolvedModel: string | null;
                        readonly status: DecisionAnnotationStatus;
                      } | null;
                      readonly id: string;
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
                readonly experimentId: string;
                readonly id: string;
                readonly output: any | null;
                readonly startTime: string;
              }>;
            }>;
            readonly externalId: string | null;
            readonly id: string;
            readonly revision: {
              readonly input: any;
              readonly referenceOutput: any;
            };
          };
          readonly id: string;
          readonly output: any | null;
          readonly repetitionNumber: number;
          readonly startTime: string;
          readonly trace: {
            readonly projectId: string;
            readonly traceId: string;
          } | null;
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

import ExperimentCompareListPageQuery_graphql from './ExperimentCompareListPageQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = [
  "experiment",
  "runs"
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
  "name": "output",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "startTime",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "endTime",
  "storageKey": null
},
v5 = {
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
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "value",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "probability",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "confidence",
  "storageKey": null
},
v13 = {
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
              "concreteType": "DecisionAnnotation",
              "kind": "LinkedField",
              "name": "decision",
              "plural": false,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "status",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "DecisionAnnotationQuestion",
                  "kind": "LinkedField",
                  "name": "question",
                  "plural": false,
                  "selections": [
                    (v6/*:: as any*/),
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "type",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "DecisionChoiceOption",
                      "kind": "LinkedField",
                      "name": "choices",
                      "plural": true,
                      "selections": [
                        (v7/*:: as any*/),
                        (v8/*:: as any*/)
                      ],
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "DecisionScaleLevel",
                      "kind": "LinkedField",
                      "name": "levels",
                      "plural": true,
                      "selections": [
                        (v9/*:: as any*/),
                        (v8/*:: as any*/)
                      ],
                      "storageKey": null
                    }
                  ],
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "concreteType": null,
                  "kind": "LinkedField",
                  "name": "answer",
                  "plural": false,
                  "selections": [
                    (v10/*:: as any*/),
                    {
                      "kind": "InlineFragment",
                      "selections": [
                        (v11/*:: as any*/)
                      ],
                      "type": "PredicateAnswer",
                      "abstractKey": null
                    },
                    {
                      "kind": "InlineFragment",
                      "selections": [
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "choice",
                          "storageKey": null
                        },
                        (v12/*:: as any*/),
                        {
                          "alias": "choiceProbabilities",
                          "args": null,
                          "concreteType": "ChoiceProbability",
                          "kind": "LinkedField",
                          "name": "probabilities",
                          "plural": true,
                          "selections": [
                            (v7/*:: as any*/),
                            (v11/*:: as any*/)
                          ],
                          "storageKey": null
                        }
                      ],
                      "type": "ChoiceAnswer",
                      "abstractKey": null
                    },
                    {
                      "kind": "InlineFragment",
                      "selections": [
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "expectedLevel",
                          "storageKey": null
                        },
                        (v12/*:: as any*/),
                        {
                          "alias": "levelProbabilities",
                          "args": null,
                          "concreteType": "LevelProbability",
                          "kind": "LinkedField",
                          "name": "probabilities",
                          "plural": true,
                          "selections": [
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "level",
                              "storageKey": null
                            },
                            (v11/*:: as any*/)
                          ],
                          "storageKey": null
                        }
                      ],
                      "type": "ScaleAnswer",
                      "abstractKey": null
                    }
                  ],
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "requestedModel",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "resolvedModel",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "modelProvider",
                  "storageKey": null
                }
              ],
              "storageKey": null
            },
            (v6/*:: as any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "score",
              "storageKey": null
            },
            (v9/*:: as any*/),
            (v1/*:: as any*/)
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "experimentId",
  "storageKey": null
};
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "after"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "baseExperimentId"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "compareExperimentIds"
    },
    {
      "defaultValue": 50,
      "kind": "LocalArgument",
      "name": "first"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "sort"
    }
  ],
  "kind": "Fragment",
  "metadata": {
    "connection": [
      {
        "count": "first",
        "cursor": "after",
        "direction": "forward",
        "path": (v0/*:: as any*/)
      }
    ],
    "refetch": {
      "connection": {
        "forward": {
          "count": "first",
          "cursor": "after"
        },
        "backward": null,
        "path": (v0/*:: as any*/)
      },
      "fragmentPathInResult": [],
      "operation": ExperimentCompareListPageQuery_graphql
    }
  },
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
            (v1/*:: as any*/),
            {
              "alias": "runs",
              "args": [
                {
                  "kind": "Variable",
                  "name": "sort",
                  "variableName": "sort"
                }
              ],
              "concreteType": "ExperimentRunConnection",
              "kind": "LinkedField",
              "name": "__ExperimentCompareListPage_runs_connection",
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
                        (v1/*:: as any*/),
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "repetitionNumber",
                          "storageKey": null
                        },
                        (v2/*:: as any*/),
                        (v3/*:: as any*/),
                        (v4/*:: as any*/),
                        {
                          "alias": null,
                          "args": null,
                          "concreteType": "Trace",
                          "kind": "LinkedField",
                          "name": "trace",
                          "plural": false,
                          "selections": [
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "traceId",
                              "storageKey": null
                            },
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "projectId",
                              "storageKey": null
                            }
                          ],
                          "storageKey": null
                        },
                        (v5/*:: as any*/),
                        (v13/*:: as any*/),
                        {
                          "alias": null,
                          "args": null,
                          "concreteType": "DatasetExample",
                          "kind": "LinkedField",
                          "name": "example",
                          "plural": false,
                          "selections": [
                            (v1/*:: as any*/),
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "externalId",
                              "storageKey": null
                            },
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
                              "concreteType": "ExperimentRepeatedRunGroup",
                              "kind": "LinkedField",
                              "name": "experimentRepeatedRunGroups",
                              "plural": true,
                              "selections": [
                                (v14/*:: as any*/),
                                {
                                  "alias": null,
                                  "args": null,
                                  "concreteType": "ExperimentRun",
                                  "kind": "LinkedField",
                                  "name": "runs",
                                  "plural": true,
                                  "selections": [
                                    (v1/*:: as any*/),
                                    (v14/*:: as any*/),
                                    (v2/*:: as any*/),
                                    (v3/*:: as any*/),
                                    (v4/*:: as any*/),
                                    (v5/*:: as any*/),
                                    (v13/*:: as any*/)
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
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "cursor",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "ExperimentRun",
                      "kind": "LinkedField",
                      "name": "node",
                      "plural": false,
                      "selections": [
                        (v10/*:: as any*/)
                      ],
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
              "storageKey": null
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

(node as any).hash = "7d4b72d9567661f0d9dbdd1174ac4234";

export default node;
