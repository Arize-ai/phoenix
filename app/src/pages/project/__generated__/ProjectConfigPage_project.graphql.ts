/**
 * @generated SignedSource<<bb08b05fa53fd6df12d7afb05367e9a6>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectConfigPage_project$data = {
  readonly id: string;
  readonly name: string;
  readonly " $fragmentType": "ProjectConfigPage_project";
};
export type ProjectConfigPage_project$key = {
  readonly " $data"?: ProjectConfigPage_project$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectConfigPage_project">;
};

import ProjectConfigPageRefetchQuery_graphql from './ProjectConfigPageRefetchQuery.graphql';

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [
        "node"
      ],
      "operation": ProjectConfigPageRefetchQuery_graphql,
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
    }
  },
  "name": "ProjectConfigPage_project",
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
      "name": "id",
      "storageKey": null
    }
  ],
  "type": "Project",
  "abstractKey": null
};

(node as any).hash = "689e9854bf02818485e0002dbcddc081";

export default node;
