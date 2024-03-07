/**
 * @generated SignedSource<<20221955c9e331578e3572d28a8f15d2>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type ProjectsPageQuery$variables = {};
export type ProjectsPageQuery$data = {
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
};
export type ProjectsPageQuery = {
  response: ProjectsPageQuery$data;
  variables: ProjectsPageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
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
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectsPageQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "ProjectsPageQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "c764e9c84a8e587d4cd443e5a89d9d08",
    "id": null,
    "metadata": {},
    "name": "ProjectsPageQuery",
    "operationKind": "query",
    "text": "query ProjectsPageQuery {\n  projects {\n    edges {\n      project: node {\n        id\n        name\n        traceCount\n        endTime\n        latencyMsP50\n        tokenCountTotal\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "30cecd830090138aa83f855b3ebdc323";

export default node;
