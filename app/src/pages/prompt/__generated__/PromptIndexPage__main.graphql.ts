/**
 * @generated SignedSource<<e499062a95936b7eccc8d91c8f6dd096>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptIndexPage__main$data = {
  readonly promptVersions: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly " $fragmentSpreads": FragmentRefs<"PromptChatMessages__main" | "PromptInvocationParameters__main">;
      };
    }>;
  };
  readonly " $fragmentSpreads": FragmentRefs<"PromptIndexPage__aside">;
  readonly " $fragmentType": "PromptIndexPage__main";
};
export type PromptIndexPage__main$key = {
  readonly " $data"?: PromptIndexPage__main$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptIndexPage__main">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PromptIndexPage__main",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "PromptVersionConnection",
      "kind": "LinkedField",
      "name": "promptVersions",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "PromptVersionEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "PromptVersion",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                {
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "PromptInvocationParameters__main"
                },
                {
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "PromptChatMessages__main"
                }
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "PromptIndexPage__aside"
    }
  ],
  "type": "Prompt",
  "abstractKey": null
};

(node as any).hash = "272d9002d4e1031d850f68a838d7af35";

export default node;