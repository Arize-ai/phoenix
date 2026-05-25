/**
 * @generated SignedSource<<67f9d943664688f92cea5551e04ebb65>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type dashboardsLoaderQuery$variables = {
  hasSelectedProject: boolean;
  projectId: string;
};
export type dashboardsLoaderQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"ProjectSelector_projects">;
};
export type dashboardsLoaderQuery = {
  response: dashboardsLoaderQuery$data;
  variables: dashboardsLoaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "hasSelectedProject"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "projectId"
  }
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
},
v4 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 50
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "dashboardsLoaderQuery",
    "selections": [
      {
        "args": [
          {
            "kind": "Variable",
            "name": "hasSelectedProject",
            "variableName": "hasSelectedProject"
          },
          {
            "kind": "Variable",
            "name": "selectedProjectId",
            "variableName": "projectId"
          }
        ],
        "kind": "FragmentSpread",
        "name": "ProjectSelector_projects"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "dashboardsLoaderQuery",
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
                "variableName": "projectId"
              }
            ],
            "concreteType": null,
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              (v1/*: any*/),
              (v2/*: any*/),
              {
                "kind": "InlineFragment",
                "selections": [
                  (v3/*: any*/)
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
        "alias": null,
        "args": (v4/*: any*/),
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
                  (v2/*: any*/),
                  (v3/*: any*/)
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
                  (v1/*: any*/),
                  (v2/*: any*/)
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
        "storageKey": "projects(first:50)"
      },
      {
        "alias": null,
        "args": (v4/*: any*/),
        "filters": [
          "filter"
        ],
        "handle": "connection",
        "key": "ProjectSelector_projects",
        "kind": "LinkedHandle",
        "name": "projects"
      }
    ]
  },
  "params": {
    "cacheID": "3739049ea569e27db99d434cd25e91c3",
    "id": null,
    "metadata": {},
    "name": "dashboardsLoaderQuery",
    "operationKind": "query",
    "text": "query dashboardsLoaderQuery(\n  $hasSelectedProject: Boolean!\n  $projectId: ID!\n) {\n  ...ProjectSelector_projects_4wy0JP\n}\n\nfragment ProjectSelector_projects_4wy0JP on Query {\n  selectedProject: node(id: $projectId) @include(if: $hasSelectedProject) {\n    __typename\n    id\n    ... on Project {\n      name\n    }\n  }\n  projects(first: 50) {\n    edges {\n      project: node {\n        id\n        name\n      }\n      cursor\n      node {\n        __typename\n        id\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "fe2d25ddeb2e15beeaf5d35942fa5adf";

export default node;
