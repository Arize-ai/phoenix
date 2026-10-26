/**
 * @generated SignedSource<<3fae9f7c92ca7984e974b8e92b795497>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type EditDecisionButton_data$data = {
  readonly description: string | null;
  readonly id: string;
  readonly metadata: any;
  readonly " $fragmentType": "EditDecisionButton_data";
};
export type EditDecisionButton_data$key = {
  readonly " $data"?: EditDecisionButton_data$data;
  readonly " $fragmentSpreads": FragmentRefs<"EditDecisionButton_data">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "EditDecisionButton_data",
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
      "name": "metadata",
      "storageKey": null
    }
  ],
  "type": "Decision",
  "abstractKey": null
};

(node as any).hash = "46646ea2355005fe23ae2879d0ca4725";

export default node;
