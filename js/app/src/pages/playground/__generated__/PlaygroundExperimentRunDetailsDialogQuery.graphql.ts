/**
 * @generated SignedSource<<0acf91ed2d13f863781e2997aea23dee>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DecisionAnnotationQuestionType = "CHOICE" | "PREDICATE" | "SCALE";
export type DecisionAnnotationStatus = "ANSWERED" | "ERROR" | "REFUSED";
export type ExperimentRunAnnotatorKind = "CODE" | "HUMAN" | "LLM";
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "META" | "MINIMAX" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "TYPESAFE" | "XAI" | "ZAI";
export type PlaygroundExperimentRunDetailsDialogQuery$variables = {
  runId: string;
};
export type PlaygroundExperimentRunDetailsDialogQuery$data = {
  readonly run: {
    readonly annotations?: {
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
          readonly name: string;
          readonly score: number | null;
        };
      }>;
    };
    readonly endTime?: string;
    readonly error?: string | null;
    readonly example?: {
      readonly id: string;
      readonly revision: {
        readonly input: any;
        readonly output: any;
      };
    };
    readonly output?: any | null;
    readonly startTime?: string;
  };
};
export type PlaygroundExperimentRunDetailsDialogQuery = {
  response: PlaygroundExperimentRunDetailsDialogQuery$data;
  variables: PlaygroundExperimentRunDetailsDialogQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "runId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "runId"
  }
],
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
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "value",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
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
  "name": "__typename",
  "storageKey": null
},
v9 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "probability",
  "storageKey": null
},
v10 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "confidence",
  "storageKey": null
},
v11 = {
  "kind": "InlineFragment",
  "selections": [
    (v2/*:: as any*/),
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
      "concreteType": "DatasetExample",
      "kind": "LinkedField",
      "name": "example",
      "plural": false,
      "selections": [
        (v3/*:: as any*/),
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
            (v2/*:: as any*/)
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    },
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
                            (v5/*:: as any*/),
                            (v6/*:: as any*/)
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
                            (v6/*:: as any*/)
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
                        (v8/*:: as any*/),
                        {
                          "kind": "InlineFragment",
                          "selections": [
                            (v9/*:: as any*/)
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
                            (v10/*:: as any*/),
                            {
                              "alias": "choiceProbabilities",
                              "args": null,
                              "concreteType": "ChoiceProbability",
                              "kind": "LinkedField",
                              "name": "probabilities",
                              "plural": true,
                              "selections": [
                                (v5/*:: as any*/),
                                (v9/*:: as any*/)
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
                            (v10/*:: as any*/),
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
                                (v9/*:: as any*/)
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
                (v3/*:: as any*/),
                (v4/*:: as any*/),
                (v7/*:: as any*/),
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
                  "name": "annotatorKind",
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
  "type": "ExperimentRun",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "PlaygroundExperimentRunDetailsDialogQuery",
    "selections": [
      {
        "alias": "run",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v11/*:: as any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "PlaygroundExperimentRunDetailsDialogQuery",
    "selections": [
      {
        "alias": "run",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v8/*:: as any*/),
          (v11/*:: as any*/),
          (v3/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "244b022979cce680fec41247c89a6eea",
    "id": null,
    "metadata": {},
    "name": "PlaygroundExperimentRunDetailsDialogQuery",
    "operationKind": "query",
    "text": "query PlaygroundExperimentRunDetailsDialogQuery(\n  $runId: ID!\n) {\n  run: node(id: $runId) {\n    __typename\n    ... on ExperimentRun {\n      output\n      startTime\n      endTime\n      error\n      example {\n        id\n        revision {\n          input\n          output\n        }\n      }\n      annotations {\n        edges {\n          annotation: node {\n            decision {\n              status\n              question {\n                name\n                type\n                choices {\n                  value\n                  description\n                }\n                levels {\n                  label\n                  description\n                }\n              }\n              answer {\n                __typename\n                ... on PredicateAnswer {\n                  probability\n                }\n                ... on ChoiceAnswer {\n                  choice\n                  confidence\n                  choiceProbabilities: probabilities {\n                    value\n                    probability\n                  }\n                }\n                ... on ScaleAnswer {\n                  expectedLevel\n                  confidence\n                  levelProbabilities: probabilities {\n                    level\n                    probability\n                  }\n                }\n              }\n              requestedModel\n              resolvedModel\n              modelProvider\n            }\n            id\n            name\n            label\n            score\n            explanation\n            annotatorKind\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "3607a908c6a9e64b99f0c978643bdc18";

export default node;
