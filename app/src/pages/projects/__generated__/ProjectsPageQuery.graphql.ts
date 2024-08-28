/**
 * @generated SignedSource<<d91769ea4e28132b62dac1ad21ee7811>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type TimeRange = {
  end: string;
  start: string;
};
export type ProjectsPageQuery$variables = {
  timeRange: TimeRange;
};
export type ProjectsPageQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"ProjectsPageProjectsFragment">;
};
export type ProjectsPageQuery = {
  response: ProjectsPageQuery$data;
  variables: ProjectsPageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "timeRange"
  }
],
v1 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 50
  }
],
v2 = {
  "kind": "Variable",
  "name": "timeRange",
  "variableName": "timeRange"
},
v3 = [
  (v2/*: any*/)
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectsPageQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "ProjectsPageProjectsFragment"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ProjectsPageQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
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
                    "name": "gradientStartColor",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "gradientEndColor",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": (v3/*: any*/),
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
                    "alias": "latencyMsP50",
                    "args": [
                      {
                        "kind": "Literal",
                        "name": "probability",
                        "value": 0.5
                      },
                      (v2/*: any*/)
                    ],
                    "kind": "ScalarField",
                    "name": "latencyMsQuantile",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": (v3/*: any*/),
                    "kind": "ScalarField",
                    "name": "tokenCountTotal",
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
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "__typename",
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
        "args": (v1/*: any*/),
        "filters": null,
        "handle": "connection",
        "key": "ProjectsPage_projects",
        "kind": "LinkedHandle",
        "name": "projects"
      }
    ]
  },
  "params": {
    "cacheID": "35a420462b10b0f0158d042fd39bfabb",
    "id": null,
    "metadata": {},
    "name": "ProjectsPageQuery",
    "operationKind": "query",
    "text": "query ProjectsPageQuery(\n  $timeRange: TimeRange!\n) {\n  ...ProjectsPageProjectsFragment\n}\n\nfragment ProjectsPageProjectsFragment on Query {\n  projects(first: 50) {\n    edges {\n      project: node {\n        id\n        name\n        gradientStartColor\n        gradientEndColor\n        traceCount(timeRange: $timeRange)\n        endTime\n        latencyMsP50: latencyMsQuantile(probability: 0.5, timeRange: $timeRange)\n        tokenCountTotal(timeRange: $timeRange)\n      }\n      cursor\n      node {\n        __typename\n      }\n    }\n    pageInfo {\n      endCursor\n      hasNextPage\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "c28f5ced0b3ec4b3b8277d0aac29de2d";

export default node;
