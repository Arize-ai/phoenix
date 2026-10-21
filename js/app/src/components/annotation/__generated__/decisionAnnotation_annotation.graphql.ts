/**
 * @generated SignedSource<<41ecafd42e186f0d441524d093ddb528>>
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
export type decisionAnnotation_annotation$data = {
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
  readonly " $fragmentType": "decisionAnnotation_annotation";
};
export type decisionAnnotation_annotation$key = {
  readonly " $data"?: decisionAnnotation_annotation$data;
  readonly " $fragmentSpreads": FragmentRefs<"decisionAnnotation_annotation">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "value",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "probability",
  "storageKey": null
},
v3 = {
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
  "name": "decisionAnnotation_annotation",
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
                (v0/*:: as any*/),
                (v1/*:: as any*/)
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
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "label",
                  "storageKey": null
                },
                (v1/*:: as any*/)
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
                (v2/*:: as any*/)
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
                (v3/*:: as any*/),
                {
                  "alias": "choiceProbabilities",
                  "args": null,
                  "concreteType": "ChoiceProbability",
                  "kind": "LinkedField",
                  "name": "probabilities",
                  "plural": true,
                  "selections": [
                    (v0/*:: as any*/),
                    (v2/*:: as any*/)
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
                (v3/*:: as any*/),
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
                    (v2/*:: as any*/)
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
  "type": "ExperimentRunAnnotation",
  "abstractKey": null
};
})();

(node as any).hash = "3883fcad4e6581aef7323cf46edd2098";

export default node;
