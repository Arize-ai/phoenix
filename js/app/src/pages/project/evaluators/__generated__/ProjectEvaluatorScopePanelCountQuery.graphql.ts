/**
 * @generated SignedSource<<dbad92e0e2d860e8d726d62c4b78d608>>
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
  projectId: string;
  timeRange: TimeRange;
};
export type ProjectEvaluatorScopePanelCountQuery$data = {
  readonly project: {
    readonly spanCountTimeSeries?: {
      readonly data: ReadonlyArray<{
        readonly totalCount: number | null;
      }>;
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
  "name": "projectId"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeRange"
},
v3 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
],
v4 = {
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
          "name": "timeRange",
          "variableName": "timeRange"
        }
      ],
      "concreteType": "SpanCountTimeSeries",
      "kind": "LinkedField",
      "name": "spanCountTimeSeries",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "SpanCountTimeSeriesDataPoint",
          "kind": "LinkedField",
          "name": "data",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "totalCount",
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
      (v2/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectEvaluatorScopePanelCountQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v3/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v4/*:: as any*/)
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
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "ProjectEvaluatorScopePanelCountQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v3/*:: as any*/),
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
          (v4/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "f384a134a9622c9f0d1da1e2cf66128e",
    "id": null,
    "metadata": {},
    "name": "ProjectEvaluatorScopePanelCountQuery",
    "operationKind": "query",
    "text": "query ProjectEvaluatorScopePanelCountQuery(\n  $projectId: ID!\n  $timeRange: TimeRange!\n  $filterCondition: String\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      spanCountTimeSeries(timeRange: $timeRange, filterCondition: $filterCondition) {\n        data {\n          totalCount\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "8636a52a3723e2fd21df251f3d1fd592";

export default node;
