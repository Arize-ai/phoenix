/**
 * @generated SignedSource<<ab2d740cf72b5c53fa65ff7441a81b63>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type OptimizationDirection = "MAXIMIZE" | "MINIMIZE" | "NONE";
import { FragmentRefs } from "relay-runtime";
export type DatasetEvaluatorsPage_builtInEvaluators$data = {
  readonly builtInEvaluators: ReadonlyArray<{
    readonly description: string | null;
    readonly id: string;
    readonly name: string;
  }>;
  readonly classificationEvaluatorConfigs: ReadonlyArray<{
    readonly choices: any;
    readonly description: string | null;
    readonly messages: ReadonlyArray<{
      readonly " $fragmentSpreads": FragmentRefs<"promptUtils_promptMessages">;
    }>;
    readonly name: string;
    readonly optimizationDirection: OptimizationDirection;
  }>;
  readonly " $fragmentType": "DatasetEvaluatorsPage_builtInEvaluators";
};
export type DatasetEvaluatorsPage_builtInEvaluators$key = {
  readonly " $data"?: DatasetEvaluatorsPage_builtInEvaluators$data;
  readonly " $fragmentSpreads": FragmentRefs<"DatasetEvaluatorsPage_builtInEvaluators">;
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
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "DatasetEvaluatorsPage_builtInEvaluators",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "BuiltInEvaluator",
      "kind": "LinkedField",
      "name": "builtInEvaluators",
      "plural": true,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "id",
          "storageKey": null
        },
        (v0/*: any*/),
        (v1/*: any*/)
      ],
      "storageKey": null
    },
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
        (v0/*: any*/),
        (v1/*: any*/),
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
})();

(node as any).hash = "2efca65262696f4f0055ebefe23f3df7";

export default node;
