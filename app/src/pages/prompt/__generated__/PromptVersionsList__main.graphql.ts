/**
 * @generated SignedSource<<22c7cb14b9e38c3546d196c0aa711283>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptVersionsList__main$data = {
  readonly promptVersions: {
    readonly edges: ReadonlyArray<{
      readonly version: {
        readonly createdAt: string;
        readonly description: string | null;
        readonly id: string;
        readonly tags: ReadonlyArray<{
          readonly name: string;
        }>;
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
                  "name": "createdAt",
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

(node as any).hash = "5faad1693ba9af82609129d06598dec7";

export default node;
