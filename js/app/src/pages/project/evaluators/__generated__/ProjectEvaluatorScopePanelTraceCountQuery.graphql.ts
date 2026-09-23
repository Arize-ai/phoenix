/**
 * @generated SignedSource<<e84c8fb3ae24b29173ebd327a0e1a98c>>
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
export type ProjectEvaluatorScopePanelTraceCountQuery$variables = {
  first: number;
  projectId: string;
  timeRange?: TimeRange | null;
  traceFilterCondition?: string | null;
};
export type ProjectEvaluatorScopePanelTraceCountQuery$data = {
  readonly project: {
    readonly rootSpans?: {
      readonly edges: ReadonlyArray<{
        readonly span: {
          readonly id: string;
        };
      }>;
      readonly pageInfo: {
        readonly hasNextPage: boolean;
      };
    };
  };
};
export type ProjectEvaluatorScopePanelTraceCountQuery = {
  response: ProjectEvaluatorScopePanelTraceCountQuery$data;
  variables: ProjectEvaluatorScopePanelTraceCountQuery$variables;
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
          "kind": "Literal",
          "name": "filterCondition",
          "value": "parent_span is None"
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
                (v5/*:: as any*/)
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
    "name": "ProjectEvaluatorScopePanelTraceCountQuery",
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
    "name": "ProjectEvaluatorScopePanelTraceCountQuery",
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
    "cacheID": "529bbbc1481193e5d9a9cc00589b09be",
    "id": null,
    "metadata": {},
    "name": "ProjectEvaluatorScopePanelTraceCountQuery",
    "operationKind": "query",
    "text": "query ProjectEvaluatorScopePanelTraceCountQuery(\n  $projectId: ID!\n  $timeRange: TimeRange\n  $traceFilterCondition: String\n  $first: Int!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      rootSpans: spans(first: $first, filterCondition: \"parent_span is None\", sort: {col: startTime, dir: desc}, traceFilterCondition: $traceFilterCondition, timeRange: $timeRange) {\n        edges {\n          span: node {\n            id\n          }\n        }\n        pageInfo {\n          hasNextPage\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "719c527048645f78726409e80b624a39";

export default node;
