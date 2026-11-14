/**
 * @generated SignedSource<<99097f3395b41418e2746cc97ad8756c>>
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
export type ProjectEvaluatorScopePanelCountQuery$variables = {
  filterCondition?: string | null;
  first: number;
  projectId: string;
  timeRange?: TimeRange | null;
};
export type ProjectEvaluatorScopePanelCountQuery$data = {
  readonly project: {
    readonly spans?: {
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
export type ProjectEvaluatorScopePanelCountQuery = {
  response: ProjectEvaluatorScopePanelCountQuery$data;
  variables: ProjectEvaluatorScopePanelCountQuery$variables;
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
    "name": "ProjectEvaluatorScopePanelCountQuery",
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
      (v3/*:: as any*/),
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "ProjectEvaluatorScopePanelCountQuery",
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
    "cacheID": "551dc5688b0021cf1c410ac4f7f3a663",
    "id": null,
    "metadata": {},
    "name": "ProjectEvaluatorScopePanelCountQuery",
    "operationKind": "query",
    "text": "query ProjectEvaluatorScopePanelCountQuery(\n  $projectId: ID!\n  $timeRange: TimeRange\n  $filterCondition: String\n  $first: Int!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      spans(first: $first, sort: {col: startTime, dir: desc}, filterCondition: $filterCondition, timeRange: $timeRange) {\n        edges {\n          span: node {\n            id\n          }\n        }\n        pageInfo {\n          hasNextPage\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "09988aebbe77ec07c8152992821fd99a";

export default node;
