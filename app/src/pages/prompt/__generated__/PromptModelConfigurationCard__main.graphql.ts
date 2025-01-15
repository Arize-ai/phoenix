/**
 * @generated SignedSource<<89a0965570719eab85a61133888d2666>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptModelConfigurationCard__main$data = {
  readonly " $fragmentSpreads": FragmentRefs<"PromptInvocationParameters__main" | "PromptOutputSchemaFragment" | "PromptTools__main">;
  readonly " $fragmentType": "PromptModelConfigurationCard__main";
};
export type PromptModelConfigurationCard__main$key = {
  readonly " $data"?: PromptModelConfigurationCard__main$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptModelConfigurationCard__main">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PromptModelConfigurationCard__main",
  "selections": [
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "PromptInvocationParameters__main"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "PromptTools__main"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "PromptOutputSchemaFragment"
    }
  ],
  "type": "PromptVersion",
  "abstractKey": null
};

(node as any).hash = "7ec5f9f00217c6d2f622362726028683";

export default node;
