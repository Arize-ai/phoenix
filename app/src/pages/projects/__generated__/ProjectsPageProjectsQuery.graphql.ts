/**
 * @generated SignedSource<<2a8c4f4e6dc6baf963fd2dd708dc5909>>
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
export type ProjectsPageProjectsQuery$variables = {
  timeRange?: TimeRange | null;
};
export type ProjectsPageProjectsQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"ProjectsPageProjectsFragment">;
};
export type ProjectsPageProjectsQuery = {
  response: ProjectsPageProjectsQuery$data;
  variables: ProjectsPageProjectsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "timeRange"
  }
],
v1 = {
  "kind": "Variable",
  "name": "timeRange",
  "variableName": "timeRange"
},
v2 = [
  (v1/*: any*/)
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectsPageProjectsQuery",
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
    "name": "ProjectsPageProjectsQuery",
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
                    "args": (v2/*: any*/),
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
                      (v1/*: any*/)
                    ],
                    "kind": "ScalarField",
                    "name": "latencyMsQuantile",
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": (v2/*: any*/),
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
    ]
  },
  "params": {
    "cacheID": "b7b294ef46695c71a41287c42ec9392f",
    "id": null,
    "metadata": {},
    "name": "ProjectsPageProjectsQuery",
    "operationKind": "query",
    "text": "query ProjectsPageProjectsQuery(\n  $timeRange: TimeRange\n) {\n  ...ProjectsPageProjectsFragment\n}\n\nfragment ProjectsPageProjectsFragment on Query {\n  projects {\n    edges {\n      project: node {\n        id\n        name\n        gradientStartColor\n        gradientEndColor\n        traceCount(timeRange: $timeRange)\n        endTime\n        latencyMsP50: latencyMsQuantile(probability: 0.5, timeRange: $timeRange)\n        tokenCountTotal(timeRange: $timeRange)\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "eed3bc970f109d273b6235f9eb0811ae";

export default node;
