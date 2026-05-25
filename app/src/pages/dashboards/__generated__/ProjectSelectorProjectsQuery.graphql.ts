/**
 * @generated SignedSource<<dbd04c00c52b8a16ea54a3cc7cd23228>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectFilterColumn = "name";
export type ProjectFilter = {
  col: ProjectFilterColumn;
  value: string;
};
export type ProjectSelectorProjectsQuery$variables = {
  after?: string | null;
  filter?: ProjectFilter | null;
  first?: number | null;
  hasSelectedProject: boolean;
  selectedProjectId: string;
};
export type ProjectSelectorProjectsQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"ProjectSelector_projects">;
};
export type ProjectSelectorProjectsQuery = {
  response: ProjectSelectorProjectsQuery$data;
  variables: ProjectSelectorProjectsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
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
v1 = {
  "kind": "Variable",
  "name": "after",
  "variableName": "after"
},
v2 = {
  "kind": "Variable",
  "name": "filter",
  "variableName": "filter"
},
v3 = {
  "kind": "Variable",
  "name": "first",
  "variableName": "first"
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v7 = [
  (v1/*: any*/),
  (v2/*: any*/),
  (v3/*: any*/)
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectSelectorProjectsQuery",
    "selections": [
      {
        "args": [
          (v1/*: any*/),
          (v2/*: any*/),
          (v3/*: any*/),
          {
            "kind": "Variable",
            "name": "hasSelectedProject",
            "variableName": "hasSelectedProject"
          },
          {
            "kind": "Variable",
            "name": "selectedProjectId",
            "variableName": "selectedProjectId"
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
    "name": "ProjectSelectorProjectsQuery",
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
              (v4/*: any*/),
              (v5/*: any*/),
              {
                "kind": "InlineFragment",
                "selections": [
                  (v6/*: any*/)
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
        "args": (v7/*: any*/),
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
                  (v5/*: any*/),
                  (v6/*: any*/)
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
                  (v4/*: any*/),
                  (v5/*: any*/)
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
      },
      {
        "alias": null,
        "args": (v7/*: any*/),
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
    "cacheID": "e627cb258fcd136d1bac266d80b4a564",
    "id": null,
    "metadata": {},
    "name": "ProjectSelectorProjectsQuery",
    "operationKind": "query",
    "text": "query ProjectSelectorProjectsQuery(\n  $after: String = null\n  $filter: ProjectFilter = null\n  $first: Int = 50\n  $hasSelectedProject: Boolean!\n  $selectedProjectId: ID!\n) {\n  ...ProjectSelector_projects_27hoVN\n}\n\nfragment ProjectSelector_projects_27hoVN on Query {\n  selectedProject: node(id: $selectedProjectId) @include(if: $hasSelectedProject) {\n    __typename\n    id\n    ... on Project {\n      name\n    }\n  }\n  projects(first: $first, after: $after, filter: $filter) {\n    edges {\n      project: node {\n        id\n        name\n      }\n      cursor\n      node {\n        __typename\n        id\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "4776e5b282b1261f7817bdfe491a3db2";

export default node;
