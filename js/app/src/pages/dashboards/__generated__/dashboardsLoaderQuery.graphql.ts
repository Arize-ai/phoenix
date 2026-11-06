/**
 * @generated SignedSource<<80d394267fb7209519c5ed78472d0349>>
 * @lightSyntaxTransform
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
  readonly " $fragmentSpreads": FragmentRefs<"ProjectMenu_projects">;
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
    "argumentDefinitions": (v0/*:: as any*/),
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
        "name": "ProjectMenu_projects"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
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
        "alias": null,
        "args": (v4/*:: as any*/),
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
                  (v2/*:: as any*/),
                  (v3/*:: as any*/),
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
                  (v1/*:: as any*/),
                  (v2/*:: as any*/)
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
        "args": (v4/*:: as any*/),
        "filters": [
          "filter"
        ],
        "handle": "connection",
        "key": "ProjectMenu_projects",
        "kind": "LinkedHandle",
        "name": "projects"
      }
    ]
  },
  "params": {
    "cacheID": "5d463418de182761a57f32d91d2e4739",
    "id": null,
    "metadata": {},
    "name": "dashboardsLoaderQuery",
    "operationKind": "query",
    "text": "query dashboardsLoaderQuery(\n  $hasSelectedProject: Boolean!\n  $projectId: ID!\n) {\n  ...ProjectMenu_projects_4wy0JP\n}\n\nfragment ProjectMenu_projects_4wy0JP on Query {\n  selectedProject: node(id: $projectId) @include(if: $hasSelectedProject) {\n    __typename\n    id\n    ... on Project {\n      name\n    }\n  }\n  projects(first: 50) {\n    edges {\n      project: node {\n        id\n        name\n        gradientStartColor\n        gradientEndColor\n      }\n      cursor\n      node {\n        __typename\n        id\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "6fe56c8cb343694b5f9427aa7eadacc7";

export default node;
