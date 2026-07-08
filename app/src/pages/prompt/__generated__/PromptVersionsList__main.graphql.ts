/**
 * @generated SignedSource<<82be66e1386719ccc6c5e9fb61aa60bd>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptVersionsList__main$data = {
  readonly promptVersions: {
    readonly edges: ReadonlyArray<{
      readonly version: {
        readonly id: string;
        readonly " $fragmentSpreads": FragmentRefs<"PromptVersionSummaryFragment">;
      };
    }>;
  };
  readonly " $fragmentType": "PromptVersionsList__main";
};
export type PromptVersionsList__main$key = {
  readonly " $data"?: PromptVersionsList__main$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptVersionsList__main">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PromptVersionsList__main",
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
              "alias": "version",
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
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "PromptVersionSummaryFragment"
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
  "type": "Prompt",
  "abstractKey": null
};

(node as any).hash = "30cac642c3466fa8405eb71f29d27be3";

export default node;
