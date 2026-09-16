/**
 * @generated SignedSource<<9bf54dd1a09e59a3cdec021d73ca127a>>
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
export type ProjectEvaluatorScopePanelTracesQuery$variables = {
  first: number;
  projectId: string;
  timeRange?: TimeRange | null;
  traceFilterCondition?: string | null;
};
export type ProjectEvaluatorScopePanelTracesQuery$data = {
  readonly project: {
    readonly rootSpans?: {
      readonly edges: ReadonlyArray<{
        readonly span: {
          readonly id: string;
          readonly trace: {
            readonly costSummary: {
              readonly total: {
                readonly tokens: number | null;
              };
            };
            readonly evaluationContext: any | null;
            readonly id: string;
            readonly numSpans: number;
            readonly traceId: string;
          };
        };
      }>;
      readonly pageInfo: {
        readonly hasNextPage: boolean;
      };
    };
  };
};
export type ProjectEvaluatorScopePanelTracesQuery = {
  response: ProjectEvaluatorScopePanelTracesQuery$data;
  variables: ProjectEvaluatorScopePanelTracesQuery$variables;
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
  "name": "timeRange"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "traceFilterCondition"
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
      "alias": "rootSpans",
      "args": [
        {
          "kind": "Variable",
          "name": "first",
          "variableName": "first"
        },
        {
          "kind": "Literal",
          "name": "rootSpansOnly",
          "value": true
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
        },
        {
          "kind": "Variable",
          "name": "traceFilterCondition",
          "variableName": "traceFilterCondition"
        }
      ],
      "concreteType": "SpanConnection",
      "kind": "LinkedField",
      "name": "spans",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "SpanEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": "span",
              "args": null,
              "concreteType": "Span",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                (v5/*:: as any*/),
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "Trace",
                  "kind": "LinkedField",
                  "name": "trace",
                  "plural": false,
                  "selections": [
                    (v5/*:: as any*/),
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "traceId",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "numSpans",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "evaluationContext",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "SpanCostSummary",
                      "kind": "LinkedField",
                      "name": "costSummary",
                      "plural": false,
                      "selections": [
                        {
                          "alias": null,
                          "args": null,
                          "concreteType": "CostBreakdown",
                          "kind": "LinkedField",
                          "name": "total",
                          "plural": false,
                          "selections": [
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "tokens",
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
    "name": "ProjectEvaluatorScopePanelTracesQuery",
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
      (v3/*:: as any*/),
      (v2/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "ProjectEvaluatorScopePanelTracesQuery",
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
    "cacheID": "d58d153acc16bdd6a67760848f290090",
    "id": null,
    "metadata": {},
    "name": "ProjectEvaluatorScopePanelTracesQuery",
    "operationKind": "query",
    "text": "query ProjectEvaluatorScopePanelTracesQuery(\n  $projectId: ID!\n  $traceFilterCondition: String\n  $timeRange: TimeRange\n  $first: Int!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      rootSpans: spans(first: $first, rootSpansOnly: true, sort: {col: startTime, dir: desc}, traceFilterCondition: $traceFilterCondition, timeRange: $timeRange) {\n        edges {\n          span: node {\n            id\n            trace {\n              id\n              traceId\n              numSpans\n              evaluationContext\n              costSummary {\n                total {\n                  tokens\n                }\n              }\n            }\n          }\n        }\n        pageInfo {\n          hasNextPage\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "d6d46b058fa970537afb8fd58f90e2d7";

export default node;
