/**
 * @generated SignedSource<<67b98669b327e924298aa7b6facdf40a>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptTools__main$data = {
  readonly tools: {
    readonly tools: ReadonlyArray<{
      readonly function: {
        readonly description: string | null;
        readonly name: string;
        readonly parameters: any | null;
        readonly strict: boolean | null;
      };
    }>;
  } | null;
  readonly " $fragmentType": "PromptTools__main";
};
export type PromptTools__main$key = {
  readonly " $data"?: PromptTools__main$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptTools__main">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PromptTools__main",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "PromptTools",
      "kind": "LinkedField",
      "name": "tools",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "PromptToolFunction",
          "kind": "LinkedField",
          "name": "tools",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "PromptToolFunctionDefinition",
              "kind": "LinkedField",
              "name": "function",
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
                  "name": "description",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "parameters",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "strict",
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
  "type": "PromptVersion",
  "abstractKey": null
};

(node as any).hash = "507119da76561b2b15a57bdd140f7b73";

export default node;
