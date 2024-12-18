/**
 * @generated SignedSource<<2e291b3511fbd3d7c2397d6d5fe071a5>>
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
        readonly id: string;
        readonly invocationParameters: any | null;
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
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "id",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "invocationParameters",
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

(node as any).hash = "d87e485e726d754ca476a56b6b9d5fea";

export default node;
