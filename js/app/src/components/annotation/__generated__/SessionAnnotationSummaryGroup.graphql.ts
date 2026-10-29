/**
 * @generated SignedSource<<cedd33bbe452a05a20a508bec165b7a3>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type AnnotatorKind = "CODE" | "HUMAN" | "LLM";
export type DecisionAnnotationQuestionType = "CHOICE" | "PREDICATE" | "SCALE";
export type DecisionAnnotationStatus = "ANSWERED" | "ERROR" | "REFUSED";
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "META" | "MINIMAX" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "TYPESAFE" | "XAI" | "ZAI";
import { FragmentRefs } from "relay-runtime";
export type SessionAnnotationSummaryGroup$data = {
  readonly sessionAnnotations: ReadonlyArray<{
    readonly annotatorKind: AnnotatorKind;
    readonly createdAt: string;
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
    readonly updatedAt: string;
    readonly user: {
      readonly profilePictureUrl: string | null;
      readonly username: string;
    } | null;
  }>;
  readonly summarySessionAnnotationSummaries: ReadonlyArray<{
    readonly count: number;
    readonly labelCount: number;
    readonly labelFractions: ReadonlyArray<{
      readonly fraction: number;
      readonly label: string;
    }>;
    readonly meanScore: number | null;
    readonly name: string;
    readonly scoreCount: number;
  }>;
  readonly " $fragmentType": "SessionAnnotationSummaryGroup";
};
export type SessionAnnotationSummaryGroup$key = {
  readonly " $data"?: SessionAnnotationSummaryGroup$data;
  readonly " $fragmentSpreads": FragmentRefs<"SessionAnnotationSummaryGroup">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "label",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "value",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "probability",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "confidence",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "SessionAnnotationSummaryGroup",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "ProjectSessionAnnotation",
      "kind": "LinkedField",
      "name": "sessionAnnotations",
      "plural": true,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "id",
          "storageKey": null
        },
        (v0/*:: as any*/),
        (v1/*:: as any*/),
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
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "createdAt",
          "storageKey": null
        },
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
            }
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
                (v0/*:: as any*/),
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
                    (v2/*:: as any*/),
                    (v3/*:: as any*/)
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
                    (v1/*:: as any*/),
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
              "concreteType": null,
              "kind": "LinkedField",
              "name": "answer",
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
                    (v4/*:: as any*/)
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
                    (v5/*:: as any*/),
                    {
                      "alias": "choiceProbabilities",
                      "args": null,
                      "concreteType": "ChoiceProbability",
                      "kind": "LinkedField",
                      "name": "probabilities",
                      "plural": true,
                      "selections": [
                        (v2/*:: as any*/),
                        (v4/*:: as any*/)
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
                    (v5/*:: as any*/),
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
                        (v4/*:: as any*/)
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
      "storageKey": null
    },
    {
      "alias": "summarySessionAnnotationSummaries",
      "args": [
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
      "concreteType": "AnnotationSummary",
      "kind": "LinkedField",
      "name": "sessionAnnotationSummaries",
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
        {
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
            (v1/*:: as any*/)
          ],
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "meanScore",
          "storageKey": null
        },
        (v0/*:: as any*/)
      ],
      "storageKey": "sessionAnnotationSummaries(filter:{\"exclude\":{\"names\":[\"note\"]}})"
    }
  ],
  "type": "ProjectSession",
  "abstractKey": null
};
})();

(node as any).hash = "19d9571a74499527225c45b5e9589973";

export default node;
