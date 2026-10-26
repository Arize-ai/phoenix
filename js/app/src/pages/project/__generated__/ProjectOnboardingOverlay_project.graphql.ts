/**
 * @generated SignedSource<<65c2adb837aa42dd82392f3fd6a995fb>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectOnboardingOverlay_project$data = {
  readonly hasTraces: boolean;
  readonly id: string;
  readonly name: string;
  readonly " $fragmentType": "ProjectOnboardingOverlay_project";
};
export type ProjectOnboardingOverlay_project$key = {
  readonly " $data"?: ProjectOnboardingOverlay_project$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectOnboardingOverlay_project">;
};

import ProjectOnboardingOverlayRefetchQuery_graphql from './ProjectOnboardingOverlayRefetchQuery.graphql';

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [
        "node"
      ],
      "operation": ProjectOnboardingOverlayRefetchQuery_graphql,
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
    }
  },
  "name": "ProjectOnboardingOverlay_project",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "name",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "hasTraces",
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

(node as any).hash = "5262efac4671bd7940039d22b4501829";

export default node;
