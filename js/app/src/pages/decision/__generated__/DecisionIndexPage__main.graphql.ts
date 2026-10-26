/**
 * @generated SignedSource<<da97fc8c40a0d05a09239fe91581fe68>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DecisionIndexPage__main$data = {
  readonly latestVersion: {
    readonly " $fragmentSpreads": FragmentRefs<"DecisionCodeExportCard_version" | "DecisionDefinitionCard_version" | "DecisionModelConfigurationCard_version">;
  } | null;
  readonly " $fragmentSpreads": FragmentRefs<"DecisionIndexPage__aside">;
  readonly " $fragmentType": "DecisionIndexPage__main";
};
export type DecisionIndexPage__main$key = {
  readonly " $data"?: DecisionIndexPage__main$data;
  readonly " $fragmentSpreads": FragmentRefs<"DecisionIndexPage__main">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "DecisionIndexPage__main",
  "selections": [
    {
      "alias": "latestVersion",
      "args": null,
      "concreteType": "DecisionVersion",
      "kind": "LinkedField",
      "name": "version",
      "plural": false,
      "selections": [
        {
          "args": null,
          "kind": "FragmentSpread",
          "name": "DecisionDefinitionCard_version"
        },
        {
          "args": null,
          "kind": "FragmentSpread",
          "name": "DecisionModelConfigurationCard_version"
        },
        {
          "args": null,
          "kind": "FragmentSpread",
          "name": "DecisionCodeExportCard_version"
        }
      ],
      "storageKey": null
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "DecisionIndexPage__aside"
    }
  ],
  "type": "Decision",
  "abstractKey": null
};

(node as any).hash = "b9713550224e3173cc4b862750b1b64b";

export default node;
