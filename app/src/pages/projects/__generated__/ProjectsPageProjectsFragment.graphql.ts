/**
 * @generated SignedSource<<bf61c48e9978674f1d2f927e20eac561>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment, RefetchableFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectsPageProjectsFragment$data = {
  readonly projects: {
    readonly edges: ReadonlyArray<{
      readonly project: {
        readonly endTime: string | null;
        readonly id: string;
        readonly latencyMsP50: number | null;
        readonly name: string;
        readonly tokenCountTotal: number;
        readonly traceCount: number;
      };
    }>;
  };
  readonly " $fragmentType": "ProjectsPageProjectsFragment";
};
export type ProjectsPageProjectsFragment$key = {
  readonly " $data"?: ProjectsPageProjectsFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectsPageProjectsFragment">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": {
    "refetch": {
      "connection": null,
      "fragmentPathInResult": [],
      "operation": require('./ProjectsPageProjectsQuery.graphql')
    }
  },
  "name": "ProjectsPageProjectsFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
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
              "alias": "project",
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
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "traceCount",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "endTime",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "latencyMsP50",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "tokenCountTotal",
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

(node as any).hash = "cda7be8f505b3338d69dea54d66c943f";

export default node;
