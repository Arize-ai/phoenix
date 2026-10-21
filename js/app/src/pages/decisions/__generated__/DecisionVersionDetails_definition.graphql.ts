/**
 * @generated SignedSource<<383905cb1f56ec697b2e2a5d4bbaf6c8>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type DecisionTemplateFormat = "F_STRING" | "MUSTACHE";
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "META" | "MINIMAX" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "TYPESAFE" | "XAI" | "ZAI";
import { FragmentRefs } from "relay-runtime";
export type DecisionVersionDetails_definition$data = {
  readonly customProvider: {
    readonly id: string;
    readonly name: string;
  } | null;
  readonly inputs: ReadonlyArray<{
    readonly description: string | null;
    readonly jsonSchema: any | null;
    readonly name: string;
  }>;
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
    readonly __typename: "DecisionInputState";
    readonly input: string;
  } | {
    readonly __typename: "DecisionObjectState";
    readonly object: boolean;
  } | {
    readonly __typename: "DecisionTextState";
    readonly template: string;
    readonly templateFormat: DecisionTemplateFormat;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
  readonly " $fragmentType": "DecisionVersionDetails_definition";
};
export type DecisionVersionDetails_definition$key = {
  readonly " $data"?: DecisionVersionDetails_definition$data;
  readonly " $fragmentSpreads": FragmentRefs<"DecisionVersionDetails_definition">;
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
  "name": "description",
  "storageKey": null
},
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
  "name": "instructions",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "DecisionVersionDetails_definition",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "DecisionInputDefinition",
      "kind": "LinkedField",
      "name": "inputs",
      "plural": true,
      "selections": [
        (v0/*:: as any*/),
        (v1/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "jsonSchema",
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
      "name": "state",
      "plural": false,
      "selections": [
        (v2/*:: as any*/),
        {
          "kind": "InlineFragment",
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "object",
              "storageKey": null
            }
          ],
          "type": "DecisionObjectState",
          "abstractKey": null
        },
        {
          "kind": "InlineFragment",
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "template",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "templateFormat",
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
              "name": "input",
              "storageKey": null
            }
          ],
          "type": "DecisionInputState",
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
        (v2/*:: as any*/),
        {
          "kind": "InlineFragment",
          "selections": [
            (v0/*:: as any*/),
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
            (v0/*:: as any*/),
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
                (v1/*:: as any*/)
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
            (v0/*:: as any*/),
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
                (v1/*:: as any*/)
              ],
              "storageKey": null
            }
          ],
          "type": "DecisionScaleQuestion",
          "abstractKey": null
        }
      ],
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
      "concreteType": "GenerativeModelCustomProvider",
      "kind": "LinkedField",
      "name": "customProvider",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "id",
          "storageKey": null
        },
        (v0/*:: as any*/)
      ],
      "storageKey": null
    }
  ],
  "type": "DecisionVersion",
  "abstractKey": null
};
})();

(node as any).hash = "66edbb9f7680328ed9e164c2bac1af3e";

export default node;
