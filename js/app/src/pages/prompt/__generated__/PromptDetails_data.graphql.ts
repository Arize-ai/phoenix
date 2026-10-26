/**
 * @generated SignedSource<<662eab42fdeaa3ee906481a141aa434b>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptDetails_data$data = {
  readonly description: string | null;
  readonly id: string;
  readonly metadata: any;
  readonly " $fragmentType": "PromptDetails_data";
};
export type PromptDetails_data$key = {
  readonly " $data"?: PromptDetails_data$data;
  readonly " $fragmentSpreads": FragmentRefs<"PromptDetails_data">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "PromptDetails_data",
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
  "type": "Prompt",
  "abstractKey": null
};

(node as any).hash = "503f498b53ec97ed80b1999c0c0fb637";

export default node;
