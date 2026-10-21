/**
 * @generated SignedSource<<9559c2ed8716893cb98d1f061fe32326>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type DecisionAnnotationQuestionType = "CHOICE" | "PREDICATE" | "SCALE";
export type DecisionAnnotationStatus = "ANSWERED" | "ERROR" | "REFUSED";
export type ExperimentRunAnnotatorKind = "CODE" | "HUMAN" | "LLM";
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "META" | "MINIMAX" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "TYPESAFE" | "XAI" | "ZAI";
import { FragmentRefs } from "relay-runtime";
export type ExampleExperimentRunsTableFragment$data = {
  readonly experimentRuns: {
    readonly edges: ReadonlyArray<{
      readonly run: {
        readonly annotations: {
          readonly edges: ReadonlyArray<{
            readonly annotation: {
              readonly annotatorKind: ExperimentRunAnnotatorKind;
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
              readonly explanation: string | null;
              readonly id: string;
              readonly label: string | null;
              readonly metadata: any;
              readonly name: string;
              readonly score: number | null;
              readonly trace: {
                readonly id: string;
                readonly projectId: string;
                readonly traceId: string;
              } | null;
            };
          }>;
        };
        readonly endTime: string;
        readonly error: string | null;
        readonly id: string;
        readonly output: any | null;
        readonly startTime: string;
        readonly trace: {
          readonly id: string;
          readonly projectId: string;
          readonly traceId: string;
        } | null;
      };
    }>;
  };
  readonly id: string;
  readonly " $fragmentType": "ExampleExperimentRunsTableFragment";
};
export type ExampleExperimentRunsTableFragment$key = {
  readonly " $data"?: ExampleExperimentRunsTableFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"ExampleExperimentRunsTableFragment">;
};

import ExampleExperimentRunsTableQuery_graphql from './ExampleExperimentRunsTableQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = [
  "experimentRuns"
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
  "concreteType": "Trace",
  "kind": "LinkedField",
  "name": "trace",
  "plural": false,
  "selections": [
    (v1/*:: as any*/),
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
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "value",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "probability",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "confidence",
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
      "defaultValue": 100,
      "kind": "LocalArgument",
      "name": "first"
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
      "fragmentPathInResult": [
        "node"
      ],
      "operation": ExampleExperimentRunsTableQuery_graphql,
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
    }
  },
  "name": "ExampleExperimentRunsTableFragment",
  "selections": [
    {
      "alias": "experimentRuns",
      "args": null,
      "concreteType": "ExperimentRunConnection",
      "kind": "LinkedField",
      "name": "__ExampleExperimentRunsTable_experimentRuns_connection",
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
                  "name": "startTime",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "endTime",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "error",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "output",
                  "storageKey": null
                },
                (v2/*:: as any*/),
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
                                    (v3/*:: as any*/),
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
                                        (v4/*:: as any*/),
                                        (v5/*:: as any*/)
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
                                        (v6/*:: as any*/),
                                        (v5/*:: as any*/)
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
                                    (v7/*:: as any*/),
                                    {
                                      "kind": "InlineFragment",
                                      "selections": [
                                        (v8/*:: as any*/)
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
                                        (v9/*:: as any*/),
                                        {
                                          "alias": "choiceProbabilities",
                                          "args": null,
                                          "concreteType": "ChoiceProbability",
                                          "kind": "LinkedField",
                                          "name": "probabilities",
                                          "plural": true,
                                          "selections": [
                                            (v4/*:: as any*/),
                                            (v8/*:: as any*/)
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
                                        (v9/*:: as any*/),
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
                                            (v8/*:: as any*/)
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
                            (v1/*:: as any*/),
                            (v3/*:: as any*/),
                            (v6/*:: as any*/),
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
                              "name": "explanation",
                              "storageKey": null
                            },
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
                              "name": "annotatorKind",
                              "storageKey": null
                            },
                            (v2/*:: as any*/)
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
                (v7/*:: as any*/)
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
    (v1/*:: as any*/)
  ],
  "type": "DatasetExample",
  "abstractKey": null
};
})();

(node as any).hash = "a208b6612c5c3f7dbf615529200ff0e5";

export default node;
