/**
 * @generated SignedSource<<f0d8a9b00c875796c563e88e9bb84691>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type TimeRange = {
  end?: string | null;
  start?: string | null;
};
export type ProjectEvaluatorScopePanelSessionsQuery$variables = {
  first: number;
  projectId: string;
  sessionFilterCondition?: string | null;
  timeRange?: TimeRange | null;
};
export type ProjectEvaluatorScopePanelSessionsQuery$data = {
  readonly project: {
    readonly sessions?: {
      readonly edges: ReadonlyArray<{
        readonly session: {
          readonly id: string;
          readonly numTraces: number;
          readonly sessionEvaluationContext: any | null;
          readonly sessionId: string;
          readonly tokenUsage: {
            readonly total: number;
          };
        };
      }>;
      readonly pageInfo: {
        readonly hasNextPage: boolean;
      };
    };
  };
};
export type ProjectEvaluatorScopePanelSessionsQuery = {
  response: ProjectEvaluatorScopePanelSessionsQuery$data;
  variables: ProjectEvaluatorScopePanelSessionsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "first"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "projectId"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "sessionFilterCondition"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeRange"
},
v4 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
],
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v6 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Variable",
          "name": "first",
          "variableName": "first"
        },
        {
          "kind": "Variable",
          "name": "sessionFilterCondition",
          "variableName": "sessionFilterCondition"
        },
        {
          "kind": "Literal",
          "name": "sort",
          "value": {
            "col": "startTime",
            "dir": "desc"
          }
        },
        {
          "kind": "Variable",
          "name": "timeRange",
          "variableName": "timeRange"
        }
      ],
      "concreteType": "ProjectSessionConnection",
      "kind": "LinkedField",
      "name": "sessions",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "ProjectSessionEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": "session",
              "args": null,
              "concreteType": "ProjectSession",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                (v5/*:: as any*/),
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "sessionId",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "numTraces",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "TokenUsage",
                  "kind": "LinkedField",
                  "name": "tokenUsage",
                  "plural": false,
                  "selections": [
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "total",
                      "storageKey": null
                    }
                  ],
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "sessionEvaluationContext",
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
  "type": "Project",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/),
      (v3/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectEvaluatorScopePanelSessionsQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v4/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v6/*:: as any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*:: as any*/),
      (v2/*:: as any*/),
      (v3/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "ProjectEvaluatorScopePanelSessionsQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v4/*:: as any*/),
        "concreteType": null,
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
          },
          (v6/*:: as any*/),
          (v5/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "876e6b96743fcc3ec98e7dd1783fdc1a",
    "id": null,
    "metadata": {},
    "name": "ProjectEvaluatorScopePanelSessionsQuery",
    "operationKind": "query",
    "text": "query ProjectEvaluatorScopePanelSessionsQuery(\n  $projectId: ID!\n  $sessionFilterCondition: String\n  $timeRange: TimeRange\n  $first: Int!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      sessions(first: $first, sort: {col: startTime, dir: desc}, sessionFilterCondition: $sessionFilterCondition, timeRange: $timeRange) {\n        edges {\n          session: node {\n            id\n            sessionId\n            numTraces\n            tokenUsage {\n              total\n            }\n            sessionEvaluationContext\n          }\n        }\n        pageInfo {\n          hasNextPage\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "f5834cfe7302b23d3823bcce1b2c51d0";

export default node;
