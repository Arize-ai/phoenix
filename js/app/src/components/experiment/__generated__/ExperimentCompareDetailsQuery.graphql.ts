/**
 * @generated SignedSource<<358fc60c783ba8313ed3560634c89773>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DecisionAnnotationQuestionType = "CHOICE" | "PREDICATE" | "SCALE";
export type DecisionAnnotationStatus = "ANSWERED" | "ERROR" | "REFUSED";
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "META" | "MINIMAX" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "TYPESAFE" | "XAI" | "ZAI";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type ExperimentCompareDetailsQuery$variables = {
  datasetExampleId: string;
  datasetId: string;
  datasetVersionId: string;
  experimentIds: ReadonlyArray<string>;
};
export type ExperimentCompareDetailsQuery$data = {
  readonly dataset: {
    readonly datasetEvaluators?: {
      readonly edges: ReadonlyArray<{
        readonly node: {
          readonly name: string;
          readonly outputConfigs: ReadonlyArray<{
            readonly __typename: "CategoricalAnnotationConfig";
            readonly name: string;
            readonly optimizationDirection: OptimizationDirection;
            readonly values: ReadonlyArray<{
              readonly label: string;
              readonly score: number | null;
            }>;
          } | {
            readonly __typename: "ContinuousAnnotationConfig";
            readonly lowerBound: number | null;
            readonly name: string;
            readonly optimizationDirection: OptimizationDirection;
            readonly upperBound: number | null;
          } | {
            readonly __typename: "FreeformAnnotationConfig";
            readonly lowerBound: number | null;
            readonly name: string;
            readonly optimizationDirection: OptimizationDirection;
            readonly threshold: number | null;
            readonly upperBound: number | null;
          } | {
            // This will never be '%other', but we need some
            // value in case none of the concrete values match.
            readonly __typename: "%other";
          }>;
        };
      }>;
    };
    readonly experimentAnnotationSummaries?: ReadonlyArray<{
      readonly annotationName: string;
      readonly maxScore: number | null;
      readonly minScore: number | null;
    }>;
    readonly experiments?: {
      readonly edges: ReadonlyArray<{
        readonly experiment: {
          readonly id: string;
          readonly name: string;
          readonly repetitions: number;
        };
      }>;
    };
  };
  readonly example: {
    readonly experimentRuns?: {
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
                readonly metadata: any;
                readonly name: string;
                readonly score: number | null;
                readonly trace: {
                  readonly projectId: string;
                  readonly traceId: string;
                } | null;
              };
            }>;
          };
          readonly costSummary: {
            readonly total: {
              readonly cost: number | null;
              readonly tokens: number | null;
            };
          };
          readonly error: string | null;
          readonly experimentId: string;
          readonly id: string;
          readonly latencyMs: number;
          readonly output: any | null;
          readonly repetitionNumber: number;
          readonly trace: {
            readonly projectId: string;
            readonly traceId: string;
          } | null;
        };
      }>;
    };
    readonly revision?: {
      readonly input: any;
      readonly referenceOutput: any;
    };
  };
};
export type ExperimentCompareDetailsQuery = {
  response: ExperimentCompareDetailsQuery$data;
  variables: ExperimentCompareDetailsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "datasetExampleId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "datasetId"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "datasetVersionId"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "experimentIds"
},
v4 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "datasetExampleId"
  }
],
v5 = {
  "alias": null,
  "args": [
    {
      "kind": "Variable",
      "name": "datasetVersionId",
      "variableName": "datasetVersionId"
    }
  ],
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
v6 = [
  {
    "kind": "Variable",
    "name": "experimentIds",
    "variableName": "experimentIds"
  },
  {
    "kind": "Literal",
    "name": "first",
    "value": 120
  }
],
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "repetitionNumber",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "latencyMs",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "experimentId",
  "storageKey": null
},
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "output",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "error",
  "storageKey": null
},
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "traceId",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "projectId",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "concreteType": "Trace",
  "kind": "LinkedField",
  "name": "trace",
  "plural": false,
  "selections": [
    (v13/*:: as any*/),
    (v14/*:: as any*/)
  ],
  "storageKey": null
},
v16 = {
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
          "name": "cost",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "tokens",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "value",
  "storageKey": null
},
v19 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v20 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v21 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v22 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "probability",
  "storageKey": null
},
v23 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "confidence",
  "storageKey": null
},
v24 = {
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
        (v17/*:: as any*/),
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
            (v18/*:: as any*/),
            (v19/*:: as any*/)
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
            (v20/*:: as any*/),
            (v19/*:: as any*/)
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
        (v21/*:: as any*/),
        {
          "kind": "InlineFragment",
          "selections": [
            (v22/*:: as any*/)
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
            (v23/*:: as any*/),
            {
              "alias": "choiceProbabilities",
              "args": null,
              "concreteType": "ChoiceProbability",
              "kind": "LinkedField",
              "name": "probabilities",
              "plural": true,
              "selections": [
                (v18/*:: as any*/),
                (v22/*:: as any*/)
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
            (v23/*:: as any*/),
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
                (v22/*:: as any*/)
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
v25 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
},
v26 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "metadata",
  "storageKey": null
},
v27 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "datasetId"
  }
],
v28 = {
  "kind": "Literal",
  "name": "includeEphemeral",
  "value": true
},
v29 = {
  "alias": null,
  "args": [
    {
      "kind": "Variable",
      "name": "filterIds",
      "variableName": "experimentIds"
    },
    (v28/*:: as any*/)
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
            (v7/*:: as any*/),
            (v17/*:: as any*/),
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "repetitions",
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
v30 = {
  "alias": null,
  "args": [
    (v28/*:: as any*/)
  ],
  "concreteType": "DatasetExperimentAnnotationSummary",
  "kind": "LinkedField",
  "name": "experimentAnnotationSummaries",
  "plural": true,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "annotationName",
      "storageKey": null
    },
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
  "storageKey": "experimentAnnotationSummaries(includeEphemeral:true)"
},
v31 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 100
  }
],
v32 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v33 = {
  "kind": "InlineFragment",
  "selections": [
    (v17/*:: as any*/),
    (v32/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "CategoricalAnnotationValue",
      "kind": "LinkedField",
      "name": "values",
      "plural": true,
      "selections": [
        (v20/*:: as any*/),
        (v25/*:: as any*/)
      ],
      "storageKey": null
    }
  ],
  "type": "CategoricalAnnotationConfig",
  "abstractKey": null
},
v34 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "lowerBound",
  "storageKey": null
},
v35 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "upperBound",
  "storageKey": null
},
v36 = {
  "kind": "InlineFragment",
  "selections": [
    (v17/*:: as any*/),
    (v32/*:: as any*/),
    (v34/*:: as any*/),
    (v35/*:: as any*/)
  ],
  "type": "ContinuousAnnotationConfig",
  "abstractKey": null
},
v37 = {
  "kind": "InlineFragment",
  "selections": [
    (v17/*:: as any*/),
    (v32/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "threshold",
      "storageKey": null
    },
    (v34/*:: as any*/),
    (v35/*:: as any*/)
  ],
  "type": "FreeformAnnotationConfig",
  "abstractKey": null
},
v38 = {
  "alias": null,
  "args": null,
  "concreteType": "Trace",
  "kind": "LinkedField",
  "name": "trace",
  "plural": false,
  "selections": [
    (v13/*:: as any*/),
    (v14/*:: as any*/),
    (v7/*:: as any*/)
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/),
      (v3/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "ExperimentCompareDetailsQuery",
    "selections": [
      {
        "alias": "example",
        "args": (v4/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              (v5/*:: as any*/),
              {
                "alias": null,
                "args": (v6/*:: as any*/),
                "concreteType": "ExperimentRunConnection",
                "kind": "LinkedField",
                "name": "experimentRuns",
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
                          (v7/*:: as any*/),
                          (v8/*:: as any*/),
                          (v9/*:: as any*/),
                          (v10/*:: as any*/),
                          (v11/*:: as any*/),
                          (v12/*:: as any*/),
                          (v15/*:: as any*/),
                          (v16/*:: as any*/),
                          {
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
                                      (v24/*:: as any*/),
                                      (v7/*:: as any*/),
                                      (v17/*:: as any*/),
                                      (v20/*:: as any*/),
                                      (v25/*:: as any*/),
                                      (v26/*:: as any*/),
                                      (v15/*:: as any*/)
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
            "type": "DatasetExample",
            "abstractKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": "dataset",
        "args": (v27/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              (v29/*:: as any*/),
              (v30/*:: as any*/),
              {
                "alias": null,
                "args": (v31/*:: as any*/),
                "concreteType": "DatasetEvaluatorConnection",
                "kind": "LinkedField",
                "name": "datasetEvaluators",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "DatasetEvaluatorEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "DatasetEvaluator",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v17/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": null,
                            "kind": "LinkedField",
                            "name": "outputConfigs",
                            "plural": true,
                            "selections": [
                              (v21/*:: as any*/),
                              (v33/*:: as any*/),
                              (v36/*:: as any*/),
                              (v37/*:: as any*/)
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
                "storageKey": "datasetEvaluators(first:100)"
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
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*:: as any*/),
      (v0/*:: as any*/),
      (v2/*:: as any*/),
      (v3/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "ExperimentCompareDetailsQuery",
    "selections": [
      {
        "alias": "example",
        "args": (v4/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v21/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v5/*:: as any*/),
              {
                "alias": null,
                "args": (v6/*:: as any*/),
                "concreteType": "ExperimentRunConnection",
                "kind": "LinkedField",
                "name": "experimentRuns",
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
                          (v7/*:: as any*/),
                          (v8/*:: as any*/),
                          (v9/*:: as any*/),
                          (v10/*:: as any*/),
                          (v11/*:: as any*/),
                          (v12/*:: as any*/),
                          (v38/*:: as any*/),
                          (v16/*:: as any*/),
                          {
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
                                      (v24/*:: as any*/),
                                      (v7/*:: as any*/),
                                      (v17/*:: as any*/),
                                      (v20/*:: as any*/),
                                      (v25/*:: as any*/),
                                      (v26/*:: as any*/),
                                      (v38/*:: as any*/)
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
            "type": "DatasetExample",
            "abstractKey": null
          },
          (v7/*:: as any*/)
        ],
        "storageKey": null
      },
      {
        "alias": "dataset",
        "args": (v27/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v21/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v29/*:: as any*/),
              (v30/*:: as any*/),
              {
                "alias": null,
                "args": (v31/*:: as any*/),
                "concreteType": "DatasetEvaluatorConnection",
                "kind": "LinkedField",
                "name": "datasetEvaluators",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "DatasetEvaluatorEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "DatasetEvaluator",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v17/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": null,
                            "kind": "LinkedField",
                            "name": "outputConfigs",
                            "plural": true,
                            "selections": [
                              (v21/*:: as any*/),
                              (v33/*:: as any*/),
                              (v36/*:: as any*/),
                              (v37/*:: as any*/),
                              {
                                "kind": "InlineFragment",
                                "selections": [
                                  (v7/*:: as any*/)
                                ],
                                "type": "Node",
                                "abstractKey": "__isNode"
                              }
                            ],
                            "storageKey": null
                          },
                          (v7/*:: as any*/)
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": "datasetEvaluators(first:100)"
              }
            ],
            "type": "Dataset",
            "abstractKey": null
          },
          (v7/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "c985a9a444427206c2e2a34245c7e9f8",
    "id": null,
    "metadata": {},
    "name": "ExperimentCompareDetailsQuery",
    "operationKind": "query",
    "text": "query ExperimentCompareDetailsQuery(\n  $datasetId: ID!\n  $datasetExampleId: ID!\n  $datasetVersionId: ID!\n  $experimentIds: [ID!]!\n) {\n  example: node(id: $datasetExampleId) {\n    __typename\n    ... on DatasetExample {\n      revision(datasetVersionId: $datasetVersionId) {\n        input\n        referenceOutput: output\n      }\n      experimentRuns(experimentIds: $experimentIds, first: 120) {\n        edges {\n          run: node {\n            id\n            repetitionNumber\n            latencyMs\n            experimentId\n            output\n            error\n            trace {\n              traceId\n              projectId\n              id\n            }\n            costSummary {\n              total {\n                cost\n                tokens\n              }\n            }\n            annotations {\n              edges {\n                annotation: node {\n                  decision {\n                    status\n                    question {\n                      name\n                      type\n                      choices {\n                        value\n                        description\n                      }\n                      levels {\n                        label\n                        description\n                      }\n                    }\n                    answer {\n                      __typename\n                      ... on PredicateAnswer {\n                        probability\n                      }\n                      ... on ChoiceAnswer {\n                        choice\n                        confidence\n                        choiceProbabilities: probabilities {\n                          value\n                          probability\n                        }\n                      }\n                      ... on ScaleAnswer {\n                        expectedLevel\n                        confidence\n                        levelProbabilities: probabilities {\n                          level\n                          probability\n                        }\n                      }\n                    }\n                    requestedModel\n                    resolvedModel\n                    modelProvider\n                  }\n                  id\n                  name\n                  label\n                  score\n                  metadata\n                  trace {\n                    traceId\n                    projectId\n                    id\n                  }\n                }\n              }\n            }\n          }\n        }\n      }\n    }\n    id\n  }\n  dataset: node(id: $datasetId) {\n    __typename\n    ... on Dataset {\n      experiments(filterIds: $experimentIds, includeEphemeral: true) {\n        edges {\n          experiment: node {\n            id\n            name\n            repetitions\n          }\n        }\n      }\n      experimentAnnotationSummaries(includeEphemeral: true) {\n        annotationName\n        minScore\n        maxScore\n      }\n      datasetEvaluators(first: 100) {\n        edges {\n          node {\n            name\n            outputConfigs {\n              __typename\n              ... on CategoricalAnnotationConfig {\n                name\n                optimizationDirection\n                values {\n                  label\n                  score\n                }\n              }\n              ... on ContinuousAnnotationConfig {\n                name\n                optimizationDirection\n                lowerBound\n                upperBound\n              }\n              ... on FreeformAnnotationConfig {\n                name\n                optimizationDirection\n                threshold\n                lowerBound\n                upperBound\n              }\n              ... on Node {\n                __isNode: __typename\n                id\n              }\n            }\n            id\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "39a861c44102c69435739f4167c3d394";

export default node;
