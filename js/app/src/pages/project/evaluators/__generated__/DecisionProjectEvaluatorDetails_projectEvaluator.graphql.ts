/**
 * @generated SignedSource<<69779559e26c845c8663c7b27d485d1b>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "META" | "MINIMAX" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "TYPESAFE" | "XAI" | "ZAI";
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
export type PromptTemplateFormat = "F_STRING" | "MUSTACHE" | "NONE";
import { FragmentRefs } from "relay-runtime";
export type DecisionProjectEvaluatorDetails_projectEvaluator$data = {
  readonly evaluator: {
    readonly __typename: "DecisionEvaluator";
    readonly decisionVersion: {
      readonly decision: {
        readonly name: string;
      };
      readonly decisionId: string;
      readonly id: string;
      readonly modelName: string;
      readonly modelProvider: GenerativeProviderKey;
      readonly questions: ReadonlyArray<{
        readonly __typename: "DecisionChoiceQuestion";
        readonly choices: ReadonlyArray<{
          readonly description: string | null;
          readonly value: string;
        }>;
        readonly instructions: string;
        readonly name: string;
      } | {
        readonly __typename: "DecisionPredicateQuestion";
        readonly criteria: {
          readonly false: string | null;
          readonly true: string | null;
        } | null;
        readonly instructions: string;
        readonly name: string;
      } | {
        readonly __typename: "DecisionScaleQuestion";
        readonly instructions: string;
        readonly levels: ReadonlyArray<{
          readonly description: string | null;
          readonly label: string;
        }>;
        readonly name: string;
      } | {
        // This will never be '%other', but we need some
        // value in case none of the concrete values match.
        readonly __typename: "%other";
      }>;
      readonly state: {
        readonly __typename: "DecisionJsonState";
        readonly json: any;
      } | {
        readonly __typename: "DecisionTextState";
        readonly text: string;
      } | {
        // This will never be '%other', but we need some
        // value in case none of the concrete values match.
        readonly __typename: "%other";
      };
      readonly templateFormat: PromptTemplateFormat;
    };
    readonly decisionVersionTag: {
      readonly name: string;
    } | null;
    readonly scoringPolicy: {
      readonly questions: ReadonlyArray<{
        readonly __typename: string;
        readonly includeLabel?: boolean;
        readonly name: string;
        readonly optimizationDirection: OptimizationDirection;
        readonly scores?: ReadonlyArray<{
          readonly choice: string;
          readonly score: number;
        }>;
        readonly threshold?: number;
      }>;
    };
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
  readonly inputMapping: {
    readonly literalMapping: any;
    readonly pathMapping: any;
  };
  readonly " $fragmentType": "DecisionProjectEvaluatorDetails_projectEvaluator";
};
export type DecisionProjectEvaluatorDetails_projectEvaluator$key = {
  readonly " $data"?: DecisionProjectEvaluatorDetails_projectEvaluator$data;
  readonly " $fragmentSpreads": FragmentRefs<"DecisionProjectEvaluatorDetails_projectEvaluator">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v2 = [
  (v1/*:: as any*/)
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "instructions",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "DecisionProjectEvaluatorDetails_projectEvaluator",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "EvaluatorInputMapping",
      "kind": "LinkedField",
      "name": "inputMapping",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "literalMapping",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "pathMapping",
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
      "name": "evaluator",
      "plural": false,
      "selections": [
        (v0/*:: as any*/),
        {
          "kind": "InlineFragment",
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "DecisionScoringPolicy",
              "kind": "LinkedField",
              "name": "scoringPolicy",
              "plural": false,
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "concreteType": null,
                  "kind": "LinkedField",
                  "name": "questions",
                  "plural": true,
                  "selections": [
                    (v0/*:: as any*/),
                    (v1/*:: as any*/),
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "optimizationDirection",
                      "storageKey": null
                    },
                    {
                      "kind": "InlineFragment",
                      "selections": [
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "threshold",
                          "storageKey": null
                        }
                      ],
                      "type": "DecisionPredicateScoring",
                      "abstractKey": null
                    },
                    {
                      "kind": "InlineFragment",
                      "selections": [
                        {
                          "alias": null,
                          "args": null,
                          "concreteType": "DecisionChoiceScore",
                          "kind": "LinkedField",
                          "name": "scores",
                          "plural": true,
                          "selections": [
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "choice",
                              "storageKey": null
                            },
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "score",
                              "storageKey": null
                            }
                          ],
                          "storageKey": null
                        }
                      ],
                      "type": "DecisionChoiceScoring",
                      "abstractKey": null
                    },
                    {
                      "kind": "InlineFragment",
                      "selections": [
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "includeLabel",
                          "storageKey": null
                        }
                      ],
                      "type": "DecisionScaleScoring",
                      "abstractKey": null
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
              "concreteType": "DecisionVersionTag",
              "kind": "LinkedField",
              "name": "decisionVersionTag",
              "plural": false,
              "selections": (v2/*:: as any*/),
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "concreteType": "DecisionVersion",
              "kind": "LinkedField",
              "name": "decisionVersion",
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
                  "name": "decisionId",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "Decision",
                  "kind": "LinkedField",
                  "name": "decision",
                  "plural": false,
                  "selections": (v2/*:: as any*/),
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "modelName",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "modelProvider",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "templateFormat",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "concreteType": null,
                  "kind": "LinkedField",
                  "name": "state",
                  "plural": false,
                  "selections": [
                    (v0/*:: as any*/),
                    {
                      "kind": "InlineFragment",
                      "selections": [
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "text",
                          "storageKey": null
                        }
                      ],
                      "type": "DecisionTextState",
                      "abstractKey": null
                    },
                    {
                      "kind": "InlineFragment",
                      "selections": [
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "json",
                          "storageKey": null
                        }
                      ],
                      "type": "DecisionJsonState",
                      "abstractKey": null
                    }
                  ],
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "concreteType": null,
                  "kind": "LinkedField",
                  "name": "questions",
                  "plural": true,
                  "selections": [
                    (v0/*:: as any*/),
                    {
                      "kind": "InlineFragment",
                      "selections": [
                        (v1/*:: as any*/),
                        (v3/*:: as any*/),
                        {
                          "alias": null,
                          "args": null,
                          "concreteType": "DecisionPredicateCriteria",
                          "kind": "LinkedField",
                          "name": "criteria",
                          "plural": false,
                          "selections": [
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "true",
                              "storageKey": null
                            },
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "false",
                              "storageKey": null
                            }
                          ],
                          "storageKey": null
                        }
                      ],
                      "type": "DecisionPredicateQuestion",
                      "abstractKey": null
                    },
                    {
                      "kind": "InlineFragment",
                      "selections": [
                        (v1/*:: as any*/),
                        (v3/*:: as any*/),
                        {
                          "alias": null,
                          "args": null,
                          "concreteType": "DecisionChoiceOption",
                          "kind": "LinkedField",
                          "name": "choices",
                          "plural": true,
                          "selections": [
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "value",
                              "storageKey": null
                            },
                            (v4/*:: as any*/)
                          ],
                          "storageKey": null
                        }
                      ],
                      "type": "DecisionChoiceQuestion",
                      "abstractKey": null
                    },
                    {
                      "kind": "InlineFragment",
                      "selections": [
                        (v1/*:: as any*/),
                        (v3/*:: as any*/),
                        {
                          "alias": null,
                          "args": null,
                          "concreteType": "DecisionScaleLevel",
                          "kind": "LinkedField",
                          "name": "levels",
                          "plural": true,
                          "selections": [
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "label",
                              "storageKey": null
                            },
                            (v4/*:: as any*/)
                          ],
                          "storageKey": null
                        }
                      ],
                      "type": "DecisionScaleQuestion",
                      "abstractKey": null
                    }
                  ],
                  "storageKey": null
                }
              ],
              "storageKey": null
            }
          ],
          "type": "DecisionEvaluator",
          "abstractKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "ProjectEvaluator",
  "abstractKey": null
};
})();

(node as any).hash = "6dfb121212dc4ecbac07ff026d82e59a";

export default node;
