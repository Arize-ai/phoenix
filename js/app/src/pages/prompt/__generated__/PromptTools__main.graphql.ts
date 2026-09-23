/**
 * @generated SignedSource<<98e3219213547735f1119059534b326a>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptTools__main$data = {
  readonly tools: {
    readonly tools: ReadonlyArray<{
      readonly __typename: "PromptToolFunction";
      readonly function: {
        readonly description: string | null;
        readonly name: string;
        readonly parameters: any;
        readonly strict: boolean | null;
      };
    } | {
      readonly __typename: "PromptToolRaw";
      readonly raw: any;
    } | {
      // This will never be '%other', but we need some
      // value in case none of the concrete values match.
      readonly __typename: "%other";
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
          "concreteType": null,
          "kind": "LinkedField",
          "name": "tools",
          "plural": true,
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
              "type": "PromptToolFunction",
              "abstractKey": null
            },
            {
              "kind": "InlineFragment",
              "selections": [
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "raw",
                  "storageKey": null
                }
              ],
              "type": "PromptToolRaw",
              "abstractKey": null
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

(node as any).hash = "c797b1e7ea4fb404999da1f454c7ccad";

export default node;
