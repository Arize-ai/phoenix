/**
 * @generated SignedSource<<db47499276d3678b075fb071e7f6f1c2>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
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

import StreamToggleRefetchQuery_graphql from './StreamToggleRefetchQuery.graphql';

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [
        "node"
      ],
      "operation": StreamToggleRefetchQuery_graphql,
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
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
