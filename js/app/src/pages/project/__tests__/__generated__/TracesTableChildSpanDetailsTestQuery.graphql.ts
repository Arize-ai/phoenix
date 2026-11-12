/**
 * @generated SignedSource<<54e5df9bbbde082c85b3034cfcab929b>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TimeRange = {
  end?: string | null;
  start?: string | null;
};
export type TracesTableChildSpanDetailsTestQuery$variables = {
  timeRange: TimeRange;
};
export type TracesTableChildSpanDetailsTestQuery$data = {
  readonly project: {
    readonly " $fragmentSpreads": FragmentRefs<"TracesTable_spans">;
  };
};
export type TracesTableChildSpanDetailsTestQuery = {
  response: TracesTableChildSpanDetailsTestQuery$data;
  variables: TracesTableChildSpanDetailsTestQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "timeRange"
  }
],
v1 = [
  {
    "kind": "Literal",
    "name": "id",
    "value": "project-1"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v5 = {
  "kind": "Literal",
  "name": "first",
  "value": 100
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "optimizationDirection",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "score",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "lowerBound",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "upperBound",
  "storageKey": null
},
v11 = [
  (v2/*:: as any*/),
  {
    "kind": "InlineFragment",
    "selections": [
      (v4/*:: as any*/),
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "annotationType",
        "storageKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": [
          (v6/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "concreteType": "CategoricalAnnotationValue",
            "kind": "LinkedField",
            "name": "values",
            "plural": true,
            "selections": [
              (v7/*:: as any*/),
              (v8/*:: as any*/)
            ],
            "storageKey": null
          }
        ],
        "type": "CategoricalAnnotationConfig",
        "abstractKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": [
          (v6/*:: as any*/),
          (v9/*:: as any*/),
          (v10/*:: as any*/)
        ],
        "type": "ContinuousAnnotationConfig",
        "abstractKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": [
          (v6/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "threshold",
            "storageKey": null
          },
          (v9/*:: as any*/),
          (v10/*:: as any*/)
        ],
        "type": "FreeformAnnotationConfig",
        "abstractKey": null
      }
    ],
    "type": "AnnotationConfigBase",
    "abstractKey": "__isAnnotationConfigBase"
  },
  {
    "kind": "InlineFragment",
    "selections": [
      (v3/*:: as any*/)
    ],
    "type": "Node",
    "abstractKey": "__isNode"
  }
],
v12 = [
  {
    "kind": "Literal",
    "name": "filterCondition",
    "value": "parent_span is None"
  },
  {
    "kind": "Literal",
    "name": "first",
    "value": 30
  },
  {
    "kind": "Literal",
    "name": "sort",
    "value": {
      "col": "startTime",
      "dir": "desc"
    }
  },
  {
    "kind": "Variable",
    "name": "timeRange",
    "variableName": "timeRange"
  }
],
v13 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "spanKind",
  "storageKey": null
},
v14 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "statusMessage",
  "storageKey": null
},
v15 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "startTime",
  "storageKey": null
},
v16 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "endTime",
  "storageKey": null
},
v17 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "latencyMs",
  "storageKey": null
},
v18 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "parentId",
  "storageKey": null
},
v19 = [
  {
    "alias": "value",
    "args": null,
    "kind": "ScalarField",
    "name": "truncatedValue",
    "storageKey": null
  }
],
v20 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "spanId",
  "storageKey": null
},
v21 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "traceId",
  "storageKey": null
},
v22 = [
  {
    "kind": "Literal",
    "name": "filter",
    "value": {
      "exclude": {
        "names": [
          "note"
        ]
      }
    }
  }
],
v23 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "annotatorKind",
  "storageKey": null
},
v24 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v25 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "value",
  "storageKey": null
},
v26 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v27 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "probability",
  "storageKey": null
},
v28 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "confidence",
  "storageKey": null
},
v29 = [
  (v3/*:: as any*/),
  (v4/*:: as any*/),
  (v7/*:: as any*/),
  (v8/*:: as any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "explanation",
    "storageKey": null
  },
  (v23/*:: as any*/),
  (v24/*:: as any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "updatedAt",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "User",
    "kind": "LinkedField",
    "name": "user",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "username",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "profilePictureUrl",
        "storageKey": null
      },
      (v3/*:: as any*/)
    ],
    "storageKey": null
  },
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
          (v4/*:: as any*/),
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
              (v25/*:: as any*/),
              (v26/*:: as any*/)
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
              (v7/*:: as any*/),
              (v26/*:: as any*/)
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
          (v2/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v27/*:: as any*/)
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
              (v28/*:: as any*/),
              {
                "alias": "choiceProbabilities",
                "args": null,
                "concreteType": "ChoiceProbability",
                "kind": "LinkedField",
                "name": "probabilities",
                "plural": true,
                "selections": [
                  (v25/*:: as any*/),
                  (v27/*:: as any*/)
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
              (v28/*:: as any*/),
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
                  (v27/*:: as any*/)
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
  }
],
v30 = {
  "alias": null,
  "args": null,
  "concreteType": "LabelFraction",
  "kind": "LinkedField",
  "name": "labelFractions",
  "plural": true,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "fraction",
      "storageKey": null
    },
    (v7/*:: as any*/)
  ],
  "storageKey": null
},
v31 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "meanScore",
  "storageKey": null
},
v32 = {
  "enumValues": null,
  "nullable": false,
  "plural": false,
  "type": "String"
},
v33 = {
  "enumValues": [
    "CATEGORICAL",
    "CONTINUOUS",
    "FREEFORM"
  ],
  "nullable": false,
  "plural": false,
  "type": "AnnotationType"
},
v34 = {
  "enumValues": null,
  "nullable": false,
  "plural": false,
  "type": "ID"
},
v35 = {
  "enumValues": null,
  "nullable": true,
  "plural": false,
  "type": "Float"
},
v36 = {
  "enumValues": [
    "MINIMIZE",
    "MAXIMIZE",
    "NONE"
  ],
  "nullable": false,
  "plural": false,
  "type": "OptimizationDirection"
},
v37 = {
  "enumValues": null,
  "nullable": false,
  "plural": true,
  "type": "CategoricalAnnotationValue"
},
v38 = {
  "enumValues": null,
  "nullable": false,
  "plural": false,
  "type": "SpanConnection"
},
v39 = {
  "enumValues": null,
  "nullable": false,
  "plural": true,
  "type": "SpanEdge"
},
v40 = {
  "enumValues": null,
  "nullable": false,
  "plural": false,
  "type": "Span"
},
v41 = {
  "enumValues": null,
  "nullable": true,
  "plural": false,
  "type": "DateTime"
},
v42 = {
  "enumValues": null,
  "nullable": true,
  "plural": false,
  "type": "ID"
},
v43 = {
  "enumValues": [
    "chain",
    "tool",
    "llm",
    "prompt",
    "retriever",
    "embedding",
    "agent",
    "reranker",
    "evaluator",
    "guardrail",
    "decision",
    "unknown"
  ],
  "nullable": false,
  "plural": false,
  "type": "SpanKind"
},
v44 = {
  "enumValues": null,
  "nullable": false,
  "plural": false,
  "type": "DateTime"
},
v45 = {
  "enumValues": [
    "OK",
    "ERROR",
    "UNSET"
  ],
  "nullable": false,
  "plural": false,
  "type": "SpanStatusCode"
},
v46 = {
  "enumValues": null,
  "nullable": false,
  "plural": false,
  "type": "Trace"
},
v47 = {
  "enumValues": null,
  "nullable": true,
  "plural": false,
  "type": "SpanIOValue"
},
v48 = {
  "enumValues": null,
  "nullable": true,
  "plural": false,
  "type": "String"
},
v49 = {
  "enumValues": null,
  "nullable": false,
  "plural": true,
  "type": "SpanAnnotation"
},
v50 = {
  "enumValues": [
    "LLM",
    "HUMAN",
    "CODE",
    "DECISION",
    "AGENT"
  ],
  "nullable": false,
  "plural": false,
  "type": "AnnotatorKind"
},
v51 = {
  "enumValues": null,
  "nullable": false,
  "plural": true,
  "type": "AnnotationSummary"
},
v52 = {
  "enumValues": null,
  "nullable": false,
  "plural": true,
  "type": "LabelFraction"
},
v53 = {
  "enumValues": null,
  "nullable": false,
  "plural": false,
  "type": "Float"
},
v54 = {
  "enumValues": null,
  "nullable": true,
  "plural": false,
  "type": "DecisionAnnotation"
},
v55 = {
  "enumValues": null,
  "nullable": true,
  "plural": false,
  "type": "DecisionAnswer"
},
v56 = {
  "enumValues": null,
  "nullable": false,
  "plural": true,
  "type": "ChoiceProbability"
},
v57 = {
  "enumValues": null,
  "nullable": false,
  "plural": true,
  "type": "LevelProbability"
},
v58 = {
  "enumValues": null,
  "nullable": false,
  "plural": false,
  "type": "Int"
},
v59 = {
  "enumValues": [
    "OPENAI",
    "ANTHROPIC",
    "AZURE_OPENAI",
    "GOOGLE",
    "DEEPSEEK",
    "XAI",
    "OLLAMA",
    "AWS",
    "CEREBRAS",
    "FIREWORKS",
    "GROQ",
    "MOONSHOT",
    "MINIMAX",
    "PERPLEXITY",
    "TOGETHER",
    "ZAI",
    "META",
    "TYPESAFE"
  ],
  "nullable": true,
  "plural": false,
  "type": "GenerativeProviderKey"
},
v60 = {
  "enumValues": null,
  "nullable": true,
  "plural": false,
  "type": "DecisionAnnotationQuestion"
},
v61 = {
  "enumValues": null,
  "nullable": true,
  "plural": true,
  "type": "DecisionChoiceOption"
},
v62 = {
  "enumValues": null,
  "nullable": true,
  "plural": true,
  "type": "DecisionScaleLevel"
},
v63 = {
  "enumValues": [
    "PREDICATE",
    "CHOICE",
    "SCALE"
  ],
  "nullable": false,
  "plural": false,
  "type": "DecisionAnnotationQuestionType"
},
v64 = {
  "enumValues": [
    "ANSWERED",
    "REFUSED",
    "ERROR"
  ],
  "nullable": false,
  "plural": false,
  "type": "DecisionAnnotationStatus"
},
v65 = {
  "enumValues": null,
  "nullable": true,
  "plural": false,
  "type": "User"
},
v66 = {
  "enumValues": null,
  "nullable": false,
  "plural": true,
  "type": "String"
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "TracesTableChildSpanDetailsTestQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "TracesTable_spans"
          }
        ],
        "storageKey": "node(id:\"project-1\")"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "TracesTableChildSpanDetailsTestQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          (v3/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*:: as any*/),
              {
                "alias": null,
                "args": [
                  {
                    "fields": [
                      {
                        "kind": "Literal",
                        "name": "annotationNames",
                        "value": null
                      }
                    ],
                    "kind": "ObjectValue",
                    "name": "filter"
                  },
                  (v5/*:: as any*/)
                ],
                "concreteType": "ProjectEvaluatorConnection",
                "kind": "LinkedField",
                "name": "evaluators",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ProjectEvaluatorEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "ProjectEvaluator",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v4/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": null,
                            "kind": "LinkedField",
                            "name": "evaluator",
                            "plural": false,
                            "selections": [
                              (v2/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": null,
                                "kind": "LinkedField",
                                "name": "outputConfigs",
                                "plural": true,
                                "selections": (v11/*:: as any*/),
                                "storageKey": null
                              },
                              (v3/*:: as any*/)
                            ],
                            "storageKey": null
                          },
                          (v3/*:: as any*/)
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": "evaluators(filter:{\"annotationNames\":null},first:100)"
              },
              {
                "alias": "configsByName",
                "args": [
                  (v5/*:: as any*/)
                ],
                "concreteType": "AnnotationConfigConnection",
                "kind": "LinkedField",
                "name": "annotationConfigs",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "AnnotationConfigEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": "config",
                        "args": null,
                        "concreteType": null,
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": (v11/*:: as any*/),
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": "annotationConfigs(first:100)"
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "spanAnnotationNames",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "traceAnnotationNames",
                "storageKey": null
              },
              {
                "alias": "rootSpans",
                "args": (v12/*:: as any*/),
                "concreteType": "SpanConnection",
                "kind": "LinkedField",
                "name": "spans",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "SpanEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": "rootSpan",
                        "args": null,
                        "concreteType": "Span",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v3/*:: as any*/),
                          (v13/*:: as any*/),
                          (v4/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "metadata",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "statusCode",
                            "storageKey": null
                          },
                          (v14/*:: as any*/),
                          (v15/*:: as any*/),
                          (v16/*:: as any*/),
                          (v17/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "cumulativeTokenCountTotal",
                            "storageKey": null
                          },
                          (v18/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "SpanIOValue",
                            "kind": "LinkedField",
                            "name": "input",
                            "plural": false,
                            "selections": (v19/*:: as any*/),
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "SpanIOValue",
                            "kind": "LinkedField",
                            "name": "output",
                            "plural": false,
                            "selections": (v19/*:: as any*/),
                            "storageKey": null
                          },
                          (v20/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "Trace",
                            "kind": "LinkedField",
                            "name": "trace",
                            "plural": false,
                            "selections": [
                              (v3/*:: as any*/),
                              (v21/*:: as any*/),
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "userId",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "numSpans",
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
                                "alias": "summaryTraceAnnotations",
                                "args": (v22/*:: as any*/),
                                "concreteType": "TraceAnnotation",
                                "kind": "LinkedField",
                                "name": "traceAnnotations",
                                "plural": true,
                                "selections": (v29/*:: as any*/),
                                "storageKey": "traceAnnotations(filter:{\"exclude\":{\"names\":[\"note\"]}})"
                              },
                              {
                                "alias": "summaryTraceAnnotationSummaries",
                                "args": (v22/*:: as any*/),
                                "concreteType": "AnnotationSummary",
                                "kind": "LinkedField",
                                "name": "traceAnnotationSummaries",
                                "plural": true,
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "count",
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "scoreCount",
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "labelCount",
                                    "storageKey": null
                                  },
                                  (v30/*:: as any*/),
                                  (v31/*:: as any*/),
                                  (v4/*:: as any*/)
                                ],
                                "storageKey": "traceAnnotationSummaries(filter:{\"exclude\":{\"names\":[\"note\"]}})"
                              }
                            ],
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "SpanAnnotation",
                            "kind": "LinkedField",
                            "name": "spanAnnotations",
                            "plural": true,
                            "selections": [
                              (v3/*:: as any*/),
                              (v4/*:: as any*/),
                              (v7/*:: as any*/),
                              (v8/*:: as any*/),
                              (v23/*:: as any*/),
                              (v24/*:: as any*/)
                            ],
                            "storageKey": null
                          },
                          {
                            "alias": "summarySpanAnnotations",
                            "args": (v22/*:: as any*/),
                            "concreteType": "SpanAnnotation",
                            "kind": "LinkedField",
                            "name": "spanAnnotations",
                            "plural": true,
                            "selections": (v29/*:: as any*/),
                            "storageKey": "spanAnnotations(filter:{\"exclude\":{\"names\":[\"note\"]}})"
                          },
                          {
                            "alias": "summarySpanAnnotationSummaries",
                            "args": (v22/*:: as any*/),
                            "concreteType": "AnnotationSummary",
                            "kind": "LinkedField",
                            "name": "spanAnnotationSummaries",
                            "plural": true,
                            "selections": [
                              (v30/*:: as any*/),
                              (v31/*:: as any*/),
                              (v4/*:: as any*/)
                            ],
                            "storageKey": "spanAnnotationSummaries(filter:{\"exclude\":{\"names\":[\"note\"]}})"
                          },
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "DocumentRetrievalMetrics",
                            "kind": "LinkedField",
                            "name": "documentRetrievalMetrics",
                            "plural": true,
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "evaluationName",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "ndcg",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "precision",
                                "storageKey": null
                              },
                              {
                                "alias": null,
                                "args": null,
                                "kind": "ScalarField",
                                "name": "hit",
                                "storageKey": null
                              }
                            ],
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": [
                              {
                                "kind": "Literal",
                                "name": "first",
                                "value": 50
                              }
                            ],
                            "concreteType": "SpanConnection",
                            "kind": "LinkedField",
                            "name": "descendants",
                            "plural": false,
                            "selections": [
                              {
                                "alias": null,
                                "args": null,
                                "concreteType": "SpanEdge",
                                "kind": "LinkedField",
                                "name": "edges",
                                "plural": true,
                                "selections": [
                                  {
                                    "alias": null,
                                    "args": null,
                                    "concreteType": "Span",
                                    "kind": "LinkedField",
                                    "name": "node",
                                    "plural": false,
                                    "selections": [
                                      (v3/*:: as any*/),
                                      (v13/*:: as any*/),
                                      (v4/*:: as any*/),
                                      {
                                        "alias": "statusCode",
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "propagatedStatusCode",
                                        "storageKey": null
                                      },
                                      (v14/*:: as any*/),
                                      (v15/*:: as any*/),
                                      (v16/*:: as any*/),
                                      (v17/*:: as any*/),
                                      (v18/*:: as any*/),
                                      {
                                        "alias": "cumulativeTokenCountTotal",
                                        "args": null,
                                        "kind": "ScalarField",
                                        "name": "tokenCountTotal",
                                        "storageKey": null
                                      },
                                      (v20/*:: as any*/),
                                      {
                                        "alias": null,
                                        "args": null,
                                        "concreteType": "Trace",
                                        "kind": "LinkedField",
                                        "name": "trace",
                                        "plural": false,
                                        "selections": [
                                          (v3/*:: as any*/),
                                          (v21/*:: as any*/)
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
                            "storageKey": "descendants(first:50)"
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
                        "concreteType": "Span",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": [
                          (v2/*:: as any*/),
                          (v3/*:: as any*/)
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
              },
              {
                "alias": "rootSpans",
                "args": (v12/*:: as any*/),
                "filters": [
                  "sort",
                  "filterCondition",
                  "traceFilterCondition",
                  "timeRange"
                ],
                "handle": "connection",
                "key": "TracesTable_rootSpans",
                "kind": "LinkedHandle",
                "name": "spans"
              }
            ],
            "type": "Project",
            "abstractKey": null
          }
        ],
        "storageKey": "node(id:\"project-1\")"
      }
    ]
  },
  "params": {
    "cacheID": "e4804994f96bf065fca8248a681057a3",
    "id": null,
    "metadata": {
      "relayTestingSelectionTypeInfo": {
        "project": {
          "enumValues": null,
          "nullable": false,
          "plural": false,
          "type": "Node"
        },
        "project.__typename": (v32/*:: as any*/),
        "project.configsByName": {
          "enumValues": null,
          "nullable": false,
          "plural": false,
          "type": "AnnotationConfigConnection"
        },
        "project.configsByName.edges": {
          "enumValues": null,
          "nullable": false,
          "plural": true,
          "type": "AnnotationConfigEdge"
        },
        "project.configsByName.edges.config": {
          "enumValues": null,
          "nullable": false,
          "plural": false,
          "type": "AnnotationConfig"
        },
        "project.configsByName.edges.config.__isAnnotationConfigBase": (v32/*:: as any*/),
        "project.configsByName.edges.config.__isNode": (v32/*:: as any*/),
        "project.configsByName.edges.config.__typename": (v32/*:: as any*/),
        "project.configsByName.edges.config.annotationType": (v33/*:: as any*/),
        "project.configsByName.edges.config.id": (v34/*:: as any*/),
        "project.configsByName.edges.config.lowerBound": (v35/*:: as any*/),
        "project.configsByName.edges.config.name": (v32/*:: as any*/),
        "project.configsByName.edges.config.optimizationDirection": (v36/*:: as any*/),
        "project.configsByName.edges.config.threshold": (v35/*:: as any*/),
        "project.configsByName.edges.config.upperBound": (v35/*:: as any*/),
        "project.configsByName.edges.config.values": (v37/*:: as any*/),
        "project.configsByName.edges.config.values.label": (v32/*:: as any*/),
        "project.configsByName.edges.config.values.score": (v35/*:: as any*/),
        "project.evaluators": {
          "enumValues": null,
          "nullable": false,
          "plural": false,
          "type": "ProjectEvaluatorConnection"
        },
        "project.evaluators.edges": {
          "enumValues": null,
          "nullable": false,
          "plural": true,
          "type": "ProjectEvaluatorEdge"
        },
        "project.evaluators.edges.node": {
          "enumValues": null,
          "nullable": false,
          "plural": false,
          "type": "ProjectEvaluator"
        },
        "project.evaluators.edges.node.evaluator": {
          "enumValues": null,
          "nullable": false,
          "plural": false,
          "type": "Evaluator"
        },
        "project.evaluators.edges.node.evaluator.__typename": (v32/*:: as any*/),
        "project.evaluators.edges.node.evaluator.id": (v34/*:: as any*/),
        "project.evaluators.edges.node.evaluator.outputConfigs": {
          "enumValues": null,
          "nullable": false,
          "plural": true,
          "type": "BuiltInEvaluatorOutputConfig"
        },
        "project.evaluators.edges.node.evaluator.outputConfigs.__isAnnotationConfigBase": (v32/*:: as any*/),
        "project.evaluators.edges.node.evaluator.outputConfigs.__isNode": (v32/*:: as any*/),
        "project.evaluators.edges.node.evaluator.outputConfigs.__typename": (v32/*:: as any*/),
        "project.evaluators.edges.node.evaluator.outputConfigs.annotationType": (v33/*:: as any*/),
        "project.evaluators.edges.node.evaluator.outputConfigs.id": (v34/*:: as any*/),
        "project.evaluators.edges.node.evaluator.outputConfigs.lowerBound": (v35/*:: as any*/),
        "project.evaluators.edges.node.evaluator.outputConfigs.name": (v32/*:: as any*/),
        "project.evaluators.edges.node.evaluator.outputConfigs.optimizationDirection": (v36/*:: as any*/),
        "project.evaluators.edges.node.evaluator.outputConfigs.threshold": (v35/*:: as any*/),
        "project.evaluators.edges.node.evaluator.outputConfigs.upperBound": (v35/*:: as any*/),
        "project.evaluators.edges.node.evaluator.outputConfigs.values": (v37/*:: as any*/),
        "project.evaluators.edges.node.evaluator.outputConfigs.values.label": (v32/*:: as any*/),
        "project.evaluators.edges.node.evaluator.outputConfigs.values.score": (v35/*:: as any*/),
        "project.evaluators.edges.node.id": (v34/*:: as any*/),
        "project.evaluators.edges.node.name": {
          "enumValues": null,
          "nullable": false,
          "plural": false,
          "type": "Identifier"
        },
        "project.id": (v34/*:: as any*/),
        "project.name": (v32/*:: as any*/),
        "project.rootSpans": (v38/*:: as any*/),
        "project.rootSpans.edges": (v39/*:: as any*/),
        "project.rootSpans.edges.cursor": (v32/*:: as any*/),
        "project.rootSpans.edges.node": (v40/*:: as any*/),
        "project.rootSpans.edges.node.__typename": (v32/*:: as any*/),
        "project.rootSpans.edges.node.id": (v34/*:: as any*/),
        "project.rootSpans.edges.rootSpan": (v40/*:: as any*/),
        "project.rootSpans.edges.rootSpan.cumulativeTokenCountTotal": (v35/*:: as any*/),
        "project.rootSpans.edges.rootSpan.descendants": (v38/*:: as any*/),
        "project.rootSpans.edges.rootSpan.descendants.edges": (v39/*:: as any*/),
        "project.rootSpans.edges.rootSpan.descendants.edges.node": (v40/*:: as any*/),
        "project.rootSpans.edges.rootSpan.descendants.edges.node.cumulativeTokenCountTotal": {
          "enumValues": null,
          "nullable": true,
          "plural": false,
          "type": "Int"
        },
        "project.rootSpans.edges.rootSpan.descendants.edges.node.endTime": (v41/*:: as any*/),
        "project.rootSpans.edges.rootSpan.descendants.edges.node.id": (v34/*:: as any*/),
        "project.rootSpans.edges.rootSpan.descendants.edges.node.latencyMs": (v35/*:: as any*/),
        "project.rootSpans.edges.rootSpan.descendants.edges.node.name": (v32/*:: as any*/),
        "project.rootSpans.edges.rootSpan.descendants.edges.node.parentId": (v42/*:: as any*/),
        "project.rootSpans.edges.rootSpan.descendants.edges.node.spanId": (v34/*:: as any*/),
        "project.rootSpans.edges.rootSpan.descendants.edges.node.spanKind": (v43/*:: as any*/),
        "project.rootSpans.edges.rootSpan.descendants.edges.node.startTime": (v44/*:: as any*/),
        "project.rootSpans.edges.rootSpan.descendants.edges.node.statusCode": (v45/*:: as any*/),
        "project.rootSpans.edges.rootSpan.descendants.edges.node.statusMessage": (v32/*:: as any*/),
        "project.rootSpans.edges.rootSpan.descendants.edges.node.trace": (v46/*:: as any*/),
        "project.rootSpans.edges.rootSpan.descendants.edges.node.trace.id": (v34/*:: as any*/),
        "project.rootSpans.edges.rootSpan.descendants.edges.node.trace.traceId": (v34/*:: as any*/),
        "project.rootSpans.edges.rootSpan.documentRetrievalMetrics": {
          "enumValues": null,
          "nullable": false,
          "plural": true,
          "type": "DocumentRetrievalMetrics"
        },
        "project.rootSpans.edges.rootSpan.documentRetrievalMetrics.evaluationName": (v32/*:: as any*/),
        "project.rootSpans.edges.rootSpan.documentRetrievalMetrics.hit": (v35/*:: as any*/),
        "project.rootSpans.edges.rootSpan.documentRetrievalMetrics.ndcg": (v35/*:: as any*/),
        "project.rootSpans.edges.rootSpan.documentRetrievalMetrics.precision": (v35/*:: as any*/),
        "project.rootSpans.edges.rootSpan.endTime": (v41/*:: as any*/),
        "project.rootSpans.edges.rootSpan.id": (v34/*:: as any*/),
        "project.rootSpans.edges.rootSpan.input": (v47/*:: as any*/),
        "project.rootSpans.edges.rootSpan.input.value": (v32/*:: as any*/),
        "project.rootSpans.edges.rootSpan.latencyMs": (v35/*:: as any*/),
        "project.rootSpans.edges.rootSpan.metadata": (v48/*:: as any*/),
        "project.rootSpans.edges.rootSpan.name": (v32/*:: as any*/),
        "project.rootSpans.edges.rootSpan.output": (v47/*:: as any*/),
        "project.rootSpans.edges.rootSpan.output.value": (v32/*:: as any*/),
        "project.rootSpans.edges.rootSpan.parentId": (v42/*:: as any*/),
        "project.rootSpans.edges.rootSpan.spanAnnotations": (v49/*:: as any*/),
        "project.rootSpans.edges.rootSpan.spanAnnotations.annotatorKind": (v50/*:: as any*/),
        "project.rootSpans.edges.rootSpan.spanAnnotations.createdAt": (v44/*:: as any*/),
        "project.rootSpans.edges.rootSpan.spanAnnotations.id": (v34/*:: as any*/),
        "project.rootSpans.edges.rootSpan.spanAnnotations.label": (v48/*:: as any*/),
        "project.rootSpans.edges.rootSpan.spanAnnotations.name": (v32/*:: as any*/),
        "project.rootSpans.edges.rootSpan.spanAnnotations.score": (v35/*:: as any*/),
        "project.rootSpans.edges.rootSpan.spanId": (v34/*:: as any*/),
        "project.rootSpans.edges.rootSpan.spanKind": (v43/*:: as any*/),
        "project.rootSpans.edges.rootSpan.startTime": (v44/*:: as any*/),
        "project.rootSpans.edges.rootSpan.statusCode": (v45/*:: as any*/),
        "project.rootSpans.edges.rootSpan.statusMessage": (v32/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotationSummaries": (v51/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotationSummaries.labelFractions": (v52/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotationSummaries.labelFractions.fraction": (v53/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotationSummaries.labelFractions.label": (v32/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotationSummaries.meanScore": (v35/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotationSummaries.name": (v32/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations": (v49/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations.annotatorKind": (v50/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations.createdAt": (v44/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations.decision": (v54/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations.decision.answer": (v55/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations.decision.answer.__typename": (v32/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations.decision.answer.choice": (v32/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations.decision.answer.choiceProbabilities": (v56/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations.decision.answer.choiceProbabilities.probability": (v53/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations.decision.answer.choiceProbabilities.value": (v32/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations.decision.answer.confidence": (v53/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations.decision.answer.expectedLevel": (v53/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations.decision.answer.levelProbabilities": (v57/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations.decision.answer.levelProbabilities.level": (v58/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations.decision.answer.levelProbabilities.probability": (v53/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations.decision.answer.probability": (v53/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations.decision.modelProvider": (v59/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations.decision.question": (v60/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations.decision.question.choices": (v61/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations.decision.question.choices.description": (v48/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations.decision.question.choices.value": (v32/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations.decision.question.levels": (v62/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations.decision.question.levels.description": (v48/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations.decision.question.levels.label": (v32/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations.decision.question.name": (v32/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations.decision.question.type": (v63/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations.decision.requestedModel": (v48/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations.decision.resolvedModel": (v48/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations.decision.status": (v64/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations.explanation": (v48/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations.id": (v34/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations.label": (v48/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations.name": (v32/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations.score": (v35/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations.updatedAt": (v44/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations.user": (v65/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations.user.id": (v34/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations.user.profilePictureUrl": (v48/*:: as any*/),
        "project.rootSpans.edges.rootSpan.summarySpanAnnotations.user.username": (v32/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace": (v46/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.costSummary": {
          "enumValues": null,
          "nullable": false,
          "plural": false,
          "type": "SpanCostSummary"
        },
        "project.rootSpans.edges.rootSpan.trace.costSummary.total": {
          "enumValues": null,
          "nullable": false,
          "plural": false,
          "type": "CostBreakdown"
        },
        "project.rootSpans.edges.rootSpan.trace.costSummary.total.cost": (v35/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.id": (v34/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.numSpans": (v58/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotationSummaries": (v51/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotationSummaries.count": (v58/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotationSummaries.labelCount": (v58/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotationSummaries.labelFractions": (v52/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotationSummaries.labelFractions.fraction": (v53/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotationSummaries.labelFractions.label": (v32/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotationSummaries.meanScore": (v35/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotationSummaries.name": (v32/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotationSummaries.scoreCount": (v58/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations": {
          "enumValues": null,
          "nullable": false,
          "plural": true,
          "type": "TraceAnnotation"
        },
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations.annotatorKind": (v50/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations.createdAt": (v44/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations.decision": (v54/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations.decision.answer": (v55/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations.decision.answer.__typename": (v32/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations.decision.answer.choice": (v32/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations.decision.answer.choiceProbabilities": (v56/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations.decision.answer.choiceProbabilities.probability": (v53/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations.decision.answer.choiceProbabilities.value": (v32/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations.decision.answer.confidence": (v53/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations.decision.answer.expectedLevel": (v53/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations.decision.answer.levelProbabilities": (v57/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations.decision.answer.levelProbabilities.level": (v58/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations.decision.answer.levelProbabilities.probability": (v53/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations.decision.answer.probability": (v53/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations.decision.modelProvider": (v59/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations.decision.question": (v60/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations.decision.question.choices": (v61/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations.decision.question.choices.description": (v48/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations.decision.question.choices.value": (v32/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations.decision.question.levels": (v62/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations.decision.question.levels.description": (v48/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations.decision.question.levels.label": (v32/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations.decision.question.name": (v32/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations.decision.question.type": (v63/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations.decision.requestedModel": (v48/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations.decision.resolvedModel": (v48/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations.decision.status": (v64/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations.explanation": (v48/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations.id": (v34/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations.label": (v48/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations.name": (v32/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations.score": (v35/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations.updatedAt": (v44/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations.user": (v65/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations.user.id": (v34/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations.user.profilePictureUrl": (v48/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.summaryTraceAnnotations.user.username": (v32/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.traceId": (v34/*:: as any*/),
        "project.rootSpans.edges.rootSpan.trace.userId": (v48/*:: as any*/),
        "project.rootSpans.pageInfo": {
          "enumValues": null,
          "nullable": false,
          "plural": false,
          "type": "PageInfo"
        },
        "project.rootSpans.pageInfo.endCursor": (v48/*:: as any*/),
        "project.rootSpans.pageInfo.hasNextPage": {
          "enumValues": null,
          "nullable": false,
          "plural": false,
          "type": "Boolean"
        },
        "project.spanAnnotationNames": (v66/*:: as any*/),
        "project.traceAnnotationNames": (v66/*:: as any*/)
      }
    },
    "name": "TracesTableChildSpanDetailsTestQuery",
    "operationKind": "query",
    "text": "query TracesTableChildSpanDetailsTestQuery(\n  $timeRange: TimeRange!\n) {\n  project: node(id: \"project-1\") {\n    __typename\n    ...TracesTable_spans\n    id\n  }\n}\n\nfragment AnnotationSummaryGroup on Span {\n  summarySpanAnnotations: spanAnnotations(filter: {exclude: {names: [\"note\"]}}) {\n    id\n    name\n    label\n    score\n    explanation\n    annotatorKind\n    createdAt\n    updatedAt\n    user {\n      username\n      profilePictureUrl\n      id\n    }\n    decision {\n      status\n      question {\n        name\n        type\n        choices {\n          value\n          description\n        }\n        levels {\n          label\n          description\n        }\n      }\n      answer {\n        __typename\n        ... on PredicateAnswer {\n          probability\n        }\n        ... on ChoiceAnswer {\n          choice\n          confidence\n          choiceProbabilities: probabilities {\n            value\n            probability\n          }\n        }\n        ... on ScaleAnswer {\n          expectedLevel\n          confidence\n          levelProbabilities: probabilities {\n            level\n            probability\n          }\n        }\n      }\n      requestedModel\n      resolvedModel\n      modelProvider\n    }\n  }\n  summarySpanAnnotationSummaries: spanAnnotationSummaries(filter: {exclude: {names: [\"note\"]}}) {\n    labelFractions {\n      fraction\n      label\n    }\n    meanScore\n    name\n  }\n}\n\nfragment ProjectAnnotationConfigsByNameFragment on Project {\n  evaluators(first: 100, filter: {}) {\n    edges {\n      node {\n        name\n        evaluator {\n          __typename\n          outputConfigs {\n            __typename\n            ...useProjectAnnotationConfigsByName_config\n            ... on Node {\n              __isNode: __typename\n              id\n            }\n          }\n          id\n        }\n        id\n      }\n    }\n  }\n  configsByName: annotationConfigs(first: 100) {\n    edges {\n      config: node {\n        __typename\n        ...useProjectAnnotationConfigsByName_config\n        ... on Node {\n          __isNode: __typename\n          id\n        }\n      }\n    }\n  }\n}\n\nfragment SpanColumnSelector_annotations on Project {\n  spanAnnotationNames\n}\n\nfragment SpanColumnSelector_traceAnnotations on Project {\n  traceAnnotationNames\n}\n\nfragment TraceAnnotationSummaryGroup on Trace {\n  summaryTraceAnnotations: traceAnnotations(filter: {exclude: {names: [\"note\"]}}) {\n    id\n    name\n    label\n    score\n    explanation\n    annotatorKind\n    createdAt\n    updatedAt\n    user {\n      username\n      profilePictureUrl\n      id\n    }\n    decision {\n      status\n      question {\n        name\n        type\n        choices {\n          value\n          description\n        }\n        levels {\n          label\n          description\n        }\n      }\n      answer {\n        __typename\n        ... on PredicateAnswer {\n          probability\n        }\n        ... on ChoiceAnswer {\n          choice\n          confidence\n          choiceProbabilities: probabilities {\n            value\n            probability\n          }\n        }\n        ... on ScaleAnswer {\n          expectedLevel\n          confidence\n          levelProbabilities: probabilities {\n            level\n            probability\n          }\n        }\n      }\n      requestedModel\n      resolvedModel\n      modelProvider\n    }\n  }\n  summaryTraceAnnotationSummaries: traceAnnotationSummaries(filter: {exclude: {names: [\"note\"]}}) {\n    count\n    scoreCount\n    labelCount\n    labelFractions {\n      fraction\n      label\n    }\n    meanScore\n    name\n  }\n}\n\nfragment TracesTable_spans on Project {\n  id\n  name\n  ...ProjectAnnotationConfigsByNameFragment\n  ...SpanColumnSelector_annotations\n  ...SpanColumnSelector_traceAnnotations\n  rootSpans: spans(first: 30, sort: {col: startTime, dir: desc}, filterCondition: \"parent_span is None\", timeRange: $timeRange) {\n    edges {\n      rootSpan: node {\n        id\n        spanKind\n        name\n        metadata\n        statusCode\n        statusMessage\n        startTime\n        endTime\n        latencyMs\n        cumulativeTokenCountTotal\n        parentId\n        input {\n          value: truncatedValue\n        }\n        output {\n          value: truncatedValue\n        }\n        spanId\n        trace {\n          id\n          traceId\n          userId\n          numSpans\n          costSummary {\n            total {\n              cost\n            }\n          }\n          ...TraceAnnotationSummaryGroup\n        }\n        spanAnnotations {\n          id\n          name\n          label\n          score\n          annotatorKind\n          createdAt\n        }\n        ...AnnotationSummaryGroup\n        documentRetrievalMetrics {\n          evaluationName\n          ndcg\n          precision\n          hit\n        }\n        descendants(first: 50) {\n          edges {\n            node {\n              id\n              spanKind\n              name\n              statusCode: propagatedStatusCode\n              statusMessage\n              startTime\n              endTime\n              latencyMs\n              parentId\n              cumulativeTokenCountTotal: tokenCountTotal\n              spanId\n              trace {\n                id\n                traceId\n              }\n            }\n          }\n        }\n      }\n      cursor\n      node {\n        __typename\n        id\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n\nfragment useProjectAnnotationConfigsByName_config on AnnotationConfigBase {\n  __isAnnotationConfigBase: __typename\n  name\n  annotationType\n  ... on CategoricalAnnotationConfig {\n    optimizationDirection\n    values {\n      label\n      score\n    }\n  }\n  ... on ContinuousAnnotationConfig {\n    optimizationDirection\n    lowerBound\n    upperBound\n  }\n  ... on FreeformAnnotationConfig {\n    optimizationDirection\n    threshold\n    lowerBound\n    upperBound\n  }\n}\n"
  }
};
})();

(node as any).hash = "235c5fce5da53eb290795a4c17e4e2cd";

export default node;
