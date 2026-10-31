/**
 * @generated SignedSource<<ea2cbce7cbf60f5ee2ea52fa75667629>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptVersionDiffPicker__versions$data = {
  readonly promptVersions: {
    readonly edges: ReadonlyArray<{
      readonly version: {
        readonly description: string | null;
        readonly id: string;
        readonly sequenceNumber: number;
        readonly tags: ReadonlyArray<{
          readonly name: string;
        }>;
        readonly user: {
          readonly username: string;
        } | null;
        readonly " $fragmentSpreads": FragmentRefs<"PromptVersionSummaryFragment">;
      };
    }>;
  };
  readonly " $fragmentType": "PromptVersionDiffPicker__versions";
};
export type PromptVersionDiffPicker__versions$key = {
  readonly " $data"?: PromptVersionDiffPicker__versions$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptVersionDiffPicker__versions">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PromptVersionDiffPicker__versions",
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
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "sequenceNumber",
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
                  "concreteType": "PromptVersionTag",
                  "kind": "LinkedField",
                  "name": "tags",
                  "plural": true,
                  "selections": [
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "name",
                      "storageKey": null
                    }
                  ],
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "User",
                  "kind": "LinkedField",
                  "name": "user",
                  "plural": false,
                  "selections": [
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "username",
                      "storageKey": null
                    }
                  ],
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

(node as any).hash = "64695b05d5746009fb989217a91fe86e";

export default node;
