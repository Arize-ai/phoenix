/**
 * @generated SignedSource<<b66fee2a31e02b002f0a332ea6232aa7>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptIndexPage__main$data = {
  readonly promptVersions: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly " $fragmentSpreads": FragmentRefs<"PromptChatMessagesCard__main" | "PromptCodeExportCard__main" | "PromptInvocationParameters__main" | "PromptModelConfigurationCard__main">;
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
                  "name": "PromptChatMessagesCard__main"
                },
                {
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "PromptCodeExportCard__main"
                },
                {
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "PromptModelConfigurationCard__main"
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

(node as any).hash = "a883b83f574448623a2b02a60d899d41";

export default node;
