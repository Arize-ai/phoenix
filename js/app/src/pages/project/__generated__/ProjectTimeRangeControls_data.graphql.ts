/**
 * @generated SignedSource<<9d18730139d597221230818321280a3c>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectTimeRangeControls_data$data = {
  readonly id: string;
  readonly isClearingTraces: boolean;
  readonly streamingLastUpdatedAt: string | null;
  readonly " $fragmentType": "ProjectTimeRangeControls_data";
};
export type ProjectTimeRangeControls_data$key = {
  readonly " $data"?: ProjectTimeRangeControls_data$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectTimeRangeControls_data">;
};

import ProjectTimeRangeControlsRefetchQuery_graphql from './ProjectTimeRangeControlsRefetchQuery.graphql';

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [
        "node"
      ],
      "operation": ProjectTimeRangeControlsRefetchQuery_graphql,
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
    }
  },
  "name": "ProjectTimeRangeControls_data",
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
      "name": "isClearingTraces",
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

(node as any).hash = "82ed3c1fea90c3757e5c182c122f42f4";

export default node;
