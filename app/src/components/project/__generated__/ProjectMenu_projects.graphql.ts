/**
 * @generated SignedSource<<6853a967dc12f5837d02e28f5c9dc13f>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectMenu_projects$data = {
  readonly projects: {
    readonly edges: ReadonlyArray<{
      readonly project: {
        readonly id: string;
        readonly name: string;
      };
    }>;
  };
  readonly selectedProject?: {
    readonly __typename: string;
    readonly id: string;
    readonly name?: string;
  };
  readonly " $fragmentType": "ProjectMenu_projects";
};
export type ProjectMenu_projects$key = {
  readonly " $data"?: ProjectMenu_projects$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectMenu_projects">;
};

import ProjectMenuProjectsQuery_graphql from './ProjectMenuProjectsQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = [
  "projects"
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
};
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "after"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "filter"
    },
    {
      "defaultValue": 50,
      "kind": "LocalArgument",
      "name": "first"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "hasSelectedProject"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "selectedProjectId"
    }
  ],
  "kind": "Fragment",
  "metadata": {
    "connection": [
      {
        "count": "first",
        "cursor": "after",
        "direction": "forward",
        "path": (v0/*:: as any*/)
      }
    ],
    "refetch": {
      "connection": {
        "forward": {
          "count": "first",
          "cursor": "after"
        },
        "backward": null,
        "path": (v0/*:: as any*/)
      },
      "fragmentPathInResult": [],
      "operation": ProjectMenuProjectsQuery_graphql
    }
  },
  "name": "ProjectMenu_projects",
  "selections": [
    {
      "condition": "hasSelectedProject",
      "kind": "Condition",
      "passingValue": true,
      "selections": [
        {
          "alias": "selectedProject",
          "args": [
            {
              "kind": "Variable",
              "name": "id",
              "variableName": "selectedProjectId"
            }
          ],
          "concreteType": null,
          "kind": "LinkedField",
          "name": "node",
          "plural": false,
          "selections": [
            (v1/*:: as any*/),
            (v2/*:: as any*/),
            {
              "kind": "InlineFragment",
              "selections": [
                (v3/*:: as any*/)
              ],
              "type": "Project",
              "abstractKey": null
            }
          ],
          "storageKey": null
        }
      ]
    },
    {
      "alias": "projects",
      "args": [
        {
          "kind": "Variable",
          "name": "filter",
          "variableName": "filter"
        }
      ],
      "concreteType": "ProjectConnection",
      "kind": "LinkedField",
      "name": "__ProjectMenu_projects_connection",
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
                (v2/*:: as any*/),
                (v3/*:: as any*/)
              ],
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "cursor",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "concreteType": "Project",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                (v1/*:: as any*/)
              ],
              "storageKey": null
            }
          ],
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "PageInfo",
          "kind": "LinkedField",
          "name": "pageInfo",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "endCursor",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "hasNextPage",
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
})();

(node as any).hash = "866a8551e0e16d25b8216cdddac490ff";

export default node;
