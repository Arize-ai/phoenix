/**
 * @generated SignedSource<<6dc01880d25571bf58ce17c68fc79e75>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptLayout__main$data = {
  readonly description: string | null;
  readonly id: string;
  readonly metadata: any;
  readonly name: string;
  readonly sourcePrompt: {
    readonly id: string;
    readonly name: string;
  } | null;
  readonly versionCount: number;
  readonly " $fragmentType": "PromptLayout__main";
};
export type PromptLayout__main$key = {
  readonly " $data"?: PromptLayout__main$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptLayout__main">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PromptLayout__main",
  "selections": [
    (v0/*:: as any*/),
    (v1/*:: as any*/),
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
      "name": "metadata",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "versionCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "Prompt",
      "kind": "LinkedField",
      "name": "sourcePrompt",
      "plural": false,
      "selections": [
        (v0/*:: as any*/),
        (v1/*:: as any*/)
      ],
      "storageKey": null
    }
  ],
  "type": "Prompt",
  "abstractKey": null
};
})();

(node as any).hash = "6b04dff140b2a04091164cda7e293018";

export default node;
