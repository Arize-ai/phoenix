/**
 * @generated SignedSource<<ac80a7c06c372e10e6ca009f6e10a7e4>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SpanKind = "agent" | "chain" | "embedding" | "evaluator" | "guardrail" | "llm" | "prompt" | "reranker" | "retriever" | "tool" | "unknown";
export type TimeRange = {
  end?: string | null;
  start?: string | null;
};
export type ProjectEvaluatorScopePanelSpansQuery$variables = {
  filterCondition?: string | null;
  first: number;
  projectId: string;
  timeRange?: TimeRange | null;
};
export type ProjectEvaluatorScopePanelSpansQuery$data = {
  readonly project: {
    readonly spans?: {
      readonly edges: ReadonlyArray<{
        readonly span: {
          readonly evaluationBoundVariables: any;
          readonly evaluationContext: any;
          readonly id: string;
          readonly name: string;
          readonly spanKind: SpanKind;
        };
      }>;
      readonly pageInfo: {
        readonly hasNextPage: boolean;
      };
    };
  };
};
export type ProjectEvaluatorScopePanelSpansQuery = {
  response: ProjectEvaluatorScopePanelSpansQuery$data;
  variables: ProjectEvaluatorScopePanelSpansQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "filterCondition"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "first"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "projectId"
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
          "name": "filterCondition",
          "variableName": "filterCondition"
        },
        {
          "kind": "Variable",
          "name": "first",
          "variableName": "first"
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
                  "kind": "ScalarField",
                  "name": "name",
                  "storageKey": null
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "spanKind",
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
                  "kind": "ScalarField",
                  "name": "evaluationBoundVariables",
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
    "name": "ProjectEvaluatorScopePanelSpansQuery",
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
      (v2/*:: as any*/),
      (v0/*:: as any*/),
      (v3/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "ProjectEvaluatorScopePanelSpansQuery",
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
    "cacheID": "b3b97d1935eac92ee571b31f6bb7175a",
    "id": null,
    "metadata": {},
    "name": "ProjectEvaluatorScopePanelSpansQuery",
    "operationKind": "query",
    "text": "query ProjectEvaluatorScopePanelSpansQuery(\n  $projectId: ID!\n  $filterCondition: String\n  $timeRange: TimeRange\n  $first: Int!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      spans(first: $first, sort: {col: startTime, dir: desc}, filterCondition: $filterCondition, timeRange: $timeRange) {\n        edges {\n          span: node {\n            id\n            name\n            spanKind\n            evaluationContext\n            evaluationBoundVariables\n          }\n        }\n        pageInfo {\n          hasNextPage\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "c56015721faaeba14069d18c742c7702";

export default node;
