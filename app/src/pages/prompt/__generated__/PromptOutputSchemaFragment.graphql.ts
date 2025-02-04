/**
 * @generated SignedSource<<567baed62f0336818cdfc67baf463837>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptOutputSchemaFragment$data = {
  readonly responseFormat: {
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
      "concreteType": "ResponseFormat",
      "kind": "LinkedField",
      "name": "responseFormat",
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

(node as any).hash = "818475e2ef28c5f0ffb9e88d0559da0a";

export default node;
