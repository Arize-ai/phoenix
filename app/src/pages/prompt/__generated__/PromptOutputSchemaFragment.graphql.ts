/**
 * @generated SignedSource<<af2571352cefa40fd18eef7b964d851d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptOutputSchemaFragment$data = {
  readonly outputSchema: {
    readonly definition: any;
  } | null;
  readonly " $fragmentType": "PromptOutputSchemaFragment";
};
export type PromptOutputSchemaFragment$key = {
  readonly " $data"?: PromptOutputSchemaFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptOutputSchemaFragment">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PromptOutputSchemaFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "OutputSchema",
      "kind": "LinkedField",
      "name": "outputSchema",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "definition",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "PromptVersion",
  "abstractKey": null
};

(node as any).hash = "80f998ac6c2d70b49bfce3478c0fda19";

export default node;
