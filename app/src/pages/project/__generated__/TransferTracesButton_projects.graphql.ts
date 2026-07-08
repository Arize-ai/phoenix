/**
 * @generated SignedSource<<2587b16dfecb35cf196bbfb5fc87bb2e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TransferTracesButton_projects$data = {
  readonly projects: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly id: string;
        readonly name: string;
      };
    }>;
  };
  readonly " $fragmentType": "TransferTracesButton_projects";
};
export type TransferTracesButton_projects$key = {
  readonly " $data"?: TransferTracesButton_projects$data;
  readonly " $fragmentSpreads": FragmentRefs<"TransferTracesButton_projects">;
};

import TransferTracesButtonProjectsQuery_graphql from './TransferTracesButtonProjectsQuery.graphql';

const node: ReaderFragment = {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "search"
    }
  ],
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [],
      "operation": TransferTracesButtonProjectsQuery_graphql
    }
  },
  "name": "TransferTracesButton_projects",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "fields": [
            {
              "kind": "Literal",
              "name": "col",
              "value": "name"
            },
            {
              "kind": "Variable",
              "name": "value",
              "variableName": "search"
            }
          ],
          "kind": "ObjectValue",
          "name": "filter"
        }
      ],
      "concreteType": "ProjectConnection",
      "kind": "LinkedField",
      "name": "projects",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "ProjectEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "Project",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
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
                }
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};

(node as any).hash = "a44c352be1e86a92920582b62ce0b767";

export default node;
