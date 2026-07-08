/**
 * @generated SignedSource<<7b076d96c55724740f3740ed94c07b10>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectConfigPage_projectConfigCard$data = {
  readonly description: string | null;
  readonly gradientEndColor: string;
  readonly gradientStartColor: string;
  readonly id: string;
  readonly name: string;
  readonly " $fragmentType": "ProjectConfigPage_projectConfigCard";
};
export type ProjectConfigPage_projectConfigCard$key = {
  readonly " $data"?: ProjectConfigPage_projectConfigCard$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectConfigPage_projectConfigCard">;
};

import ProjectConfigPageProjectConfigCardQuery_graphql from './ProjectConfigPageProjectConfigCardQuery.graphql';

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [
        "node"
      ],
      "operation": ProjectConfigPageProjectConfigCardQuery_graphql,
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
    }
  },
  "name": "ProjectConfigPage_projectConfigCard",
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
      "name": "name",
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
      "name": "gradientStartColor",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "gradientEndColor",
      "storageKey": null
    }
  ],
  "type": "Project",
  "abstractKey": null
};

(node as any).hash = "e294130f503d033996b6a81daef6a2f3";

export default node;
