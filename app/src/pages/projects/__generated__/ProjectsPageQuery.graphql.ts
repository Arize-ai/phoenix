/**
 * @generated SignedSource<<9258370758fe1af08d6cb85665285247>>
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
    "cacheID": "991909413909af281a75c58c2cd6996b",
    "id": null,
    "metadata": {},
    "name": "ProjectsPageQuery",
    "operationKind": "query",
    "text": "query ProjectsPageQuery(\n  $timeRange: TimeRange!\n) {\n  ...ProjectsPageProjectsFragment\n}\n\nfragment ProjectsPageProjectsFragment on Query {\n  projects {\n    edges {\n      project: node {\n        id\n        name\n        traceCount(timeRange: $timeRange)\n        endTime\n        latencyMsP50: latencyMsQuantile(probability: 0.5, timeRange: $timeRange)\n        tokenCountTotal(timeRange: $timeRange)\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "c28f5ced0b3ec4b3b8277d0aac29de2d";

export default node;
