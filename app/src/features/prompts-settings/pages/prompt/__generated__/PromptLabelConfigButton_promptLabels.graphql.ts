/**
 * @generated SignedSource<<e2fff49368301a5cb1379a424280c05f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptLabelConfigButton_promptLabels$data = {
  readonly id: string;
  readonly labels: ReadonlyArray<{
    readonly id: string;
  }>;
  readonly " $fragmentType": "PromptLabelConfigButton_promptLabels";
};
export type PromptLabelConfigButton_promptLabels$key = {
  readonly " $data"?: PromptLabelConfigButton_promptLabels$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptLabelConfigButton_promptLabels">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PromptLabelConfigButton_promptLabels",
  "selections": [
    (v0/*: any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "PromptLabel",
      "kind": "LinkedField",
      "name": "labels",
      "plural": true,
      "selections": [
        (v0/*: any*/)
      ],
      "storageKey": null
    }
  ],
  "type": "Prompt",
  "abstractKey": null
};
})();

(node as any).hash = "7d779bb41603b6c033aefa78571c9dd4";

export default node;
