/**
 * @generated SignedSource<<73b3327c12e75474768eb6d99fadd420>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment, RefetchableFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type StreamToggle_data$data = {
  readonly streamingLastUpdatedAt: string | null;
  readonly " $fragmentType": "StreamToggle_data";
};
export type StreamToggle_data$key = {
  readonly " $data"?: StreamToggle_data$data;
  readonly " $fragmentSpreads": FragmentRefs<"StreamToggle_data">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [],
      "operation": require('./StreamToggleRefetchQuery.graphql')
    }
  },
  "name": "StreamToggle_data",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "streamingLastUpdatedAt",
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "5a87fc2da6f4964259d4eaaaed28e26a";

export default node;
