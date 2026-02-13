/**
 * @generated SignedSource<<e302434f17c7f0e9cba03ddbe2e9b87f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
import { FragmentRefs } from "relay-runtime";
export type AddEvaluatorMenu_llmEvaluatorTemplates$data = {
  readonly classificationEvaluatorConfigs: ReadonlyArray<{
    readonly choices: any;
    readonly description: string | null;
    readonly messages: ReadonlyArray<{
      readonly " $fragmentSpreads": FragmentRefs<"promptUtils_promptMessages">;
    }>;
    readonly name: string;
    readonly optimizationDirection: OptimizationDirection;
  }>;
  readonly " $fragmentType": "AddEvaluatorMenu_llmEvaluatorTemplates";
};
export type AddEvaluatorMenu_llmEvaluatorTemplates$key = {
  readonly " $data"?: AddEvaluatorMenu_llmEvaluatorTemplates$data;
  readonly " $fragmentSpreads": FragmentRefs<"AddEvaluatorMenu_llmEvaluatorTemplates">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "AddEvaluatorMenu_llmEvaluatorTemplates",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Literal",
          "name": "label",
          "value": "dataset"
        }
      ],
      "concreteType": "ClassificationEvaluatorConfig",
      "kind": "LinkedField",
      "name": "classificationEvaluatorConfigs",
      "plural": true,
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
          "name": "description",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "choices",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "optimizationDirection",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "PromptMessage",
          "kind": "LinkedField",
          "name": "messages",
          "plural": true,
          "selections": [
            {
              "kind": "InlineDataFragmentSpread",
              "name": "promptUtils_promptMessages",
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "concreteType": null,
                  "kind": "LinkedField",
                  "name": "content",
                  "plural": true,
                  "selections": [
                    {
                      "kind": "InlineFragment",
                      "selections": [
                        {
                          "alias": null,
                          "args": null,
                          "concreteType": "TextContentValue",
                          "kind": "LinkedField",
                          "name": "text",
                          "plural": false,
                          "selections": [
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "text",
                              "storageKey": null
                            }
                          ],
                          "storageKey": null
                        }
                      ],
                      "type": "TextContentPart",
                      "abstractKey": null
                    }
                  ],
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "role",
                  "storageKey": null
                }
              ],
              "args": null,
              "argumentDefinitions": []
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": "classificationEvaluatorConfigs(label:\"dataset\")"
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "7234b58ee2af9fa73e00c52198ee7998";

export default node;
