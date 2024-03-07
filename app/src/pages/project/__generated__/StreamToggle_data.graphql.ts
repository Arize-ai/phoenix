/**
 * @generated SignedSource<<2f0657e3c6c1e4c08c7c88f0fc67c6ed>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment, RefetchableFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type StreamToggle_data$data = {
  readonly id: string;
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
      "fragmentPathInResult": [
        "node"
      ],
      "operation": require('./StreamToggleRefetchQuery.graphql'),
      "identifierField": "id"
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
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "id",
      "storageKey": null
    }
  ],
  "type": "Project",
  "abstractKey": null
};

(node as any).hash = "30a8f0bcf1aa6021b2c9a47866f5dc49";

export default node;
