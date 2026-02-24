/**
 * @generated SignedSource<<e9eb73dfb3d60165b3fd98e67d49f1fe>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptInvocationParameters__main$data = {
  readonly invocationParameters: any | null;
  readonly " $fragmentType": "PromptInvocationParameters__main";
};
export type PromptInvocationParameters__main$key = {
  readonly " $data"?: PromptInvocationParameters__main$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptInvocationParameters__main">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PromptInvocationParameters__main",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "invocationParameters",
      "storageKey": null
    }
  ],
  "type": "PromptVersion",
  "abstractKey": null
};

(node as any).hash = "4f00ab4f0396fffb81a1b068e544cfcf";

export default node;
