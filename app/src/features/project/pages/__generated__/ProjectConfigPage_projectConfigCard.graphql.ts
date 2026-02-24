/**
 * @generated SignedSource<<b95a8a79697d662de282a7f7815007b0>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectConfigPage_projectConfigCard$data = {
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

(node as any).hash = "3bd54e77e19bb08ca53696b5fc9a5c22";

export default node;
