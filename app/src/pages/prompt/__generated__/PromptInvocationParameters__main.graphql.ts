/**
 * @generated SignedSource<<821e958ae44422b9aa2886a203e76bc4>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
export type PromptToolChoiceType = "NONE" | "ONE_OR_MORE" | "SPECIFIC_FUNCTION" | "ZERO_OR_MORE";
import { FragmentRefs } from "relay-runtime";
export type PromptInvocationParameters__main$data = {
  readonly invocationParameters: any | null;
  readonly tools: {
    readonly toolChoice: {
      readonly functionName: string | null;
      readonly type: PromptToolChoiceType;
    } | null;
  } | null;
  readonly " $fragmentType": "PromptInvocationParameters__main";
};
export type PromptInvocationParameters__main$key = {
  readonly " $data"?: PromptInvocationParameters__main$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptInvocationParameters__main">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PromptInvocationParameters__main",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "invocationParameters",
      "storageKey": null
    },
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
          "concreteType": "PromptToolChoice",
          "kind": "LinkedField",
          "name": "toolChoice",
          "plural": false,
          "selections": [
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
              "kind": "ScalarField",
              "name": "functionName",
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

(node as any).hash = "24f552e356fb079a00e9ef0ad4172926";

export default node;
