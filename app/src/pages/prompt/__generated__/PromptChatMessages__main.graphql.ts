/**
 * @generated SignedSource<<5ea75ba6b7481b6171509ade1ac9215e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { Fragment, ReaderFragment } from 'relay-runtime';
export type PromptTemplateFormat = "FSTRING" | "MUSTACHE" | "NONE";
export type PromptTemplateType = "CHAT" | "STRING";
import { FragmentRefs } from "relay-runtime";
export type PromptChatMessages__main$data = {
  readonly template: any;
  readonly templateFormat: PromptTemplateFormat;
  readonly templateType: PromptTemplateType;
  readonly " $fragmentType": "PromptChatMessages__main";
};
export type PromptChatMessages__main$key = {
  readonly " $data"?: PromptChatMessages__main$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptChatMessages__main">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PromptChatMessages__main",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "template",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "templateType",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "templateFormat",
      "storageKey": null
    }
  ],
  "type": "PromptVersion",
  "abstractKey": null
};

(node as any).hash = "b77fe4ae6032fe07470e90517d5986ba";

export default node;
