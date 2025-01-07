/**
 * @generated SignedSource<<1df5dc81b46e31805c9fe34ad88f02a6>>
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
        readonly " $fragmentSpreads": FragmentRefs<"PromptVersionTagsList_data">;
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
                  "args": null,
                  "kind": "FragmentSpread",
                  "name": "PromptVersionTagsList_data"
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

(node as any).hash = "380ac9d926f313c14e1d3fd421f9896e";

export default node;
