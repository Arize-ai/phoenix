/**
 * @generated SignedSource<<ea653eac0415a464a1ceb49f5875a66b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectsPageQuery$variables = Record<PropertyKey, never>;
export type ProjectsPageQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"ProjectsPageProjectsFragment">;
};
export type ProjectsPageQuery = {
  response: ProjectsPageQuery$data;
  variables: ProjectsPageQuery$variables;
};

const node: ConcreteRequest = {
  "fragment": {
    "argumentDefinitions": [],
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
    "argumentDefinitions": [],
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
                    "alias": "latencyMsP50",
                    "args": [
                      {
                        "kind": "Literal",
                        "name": "probability",
                        "value": 0.5
                      }
                    ],
                    "kind": "ScalarField",
                    "name": "latencyMsQuantile",
                    "storageKey": "latencyMsQuantile(probability:0.5)"
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
    ]
  },
  "params": {
    "cacheID": "28f9e8120b370aeaea11dc87f747e6bc",
    "id": null,
    "metadata": {},
    "name": "ProjectsPageQuery",
    "operationKind": "query",
    "text": "query ProjectsPageQuery {\n  ...ProjectsPageProjectsFragment\n}\n\nfragment ProjectsPageProjectsFragment on Query {\n  projects {\n    edges {\n      project: node {\n        id\n        name\n        traceCount\n        endTime\n        latencyMsP50: latencyMsQuantile(probability: 0.5)\n        tokenCountTotal\n      }\n    }\n  }\n}\n"
  }
};

(node as any).hash = "9091622e2fc47fff9434aeb3407882d4";

export default node;
