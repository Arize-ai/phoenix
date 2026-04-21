/**
 * @generated SignedSource<<b9cc8f93b0ed35556d5239d6addf2706>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type TimeRange = {
  end?: string | null;
  start?: string | null;
};
export type SpansTableAsideQuery$variables = {
  filterCondition?: string | null;
  id: string;
  timeRange: TimeRange;
};
export type SpansTableAsideQuery$data = {
  readonly project: {
    readonly costSummary?: {
      readonly completion: {
        readonly cost: number | null;
      };
      readonly prompt: {
        readonly cost: number | null;
      };
      readonly total: {
        readonly cost: number | null;
      };
    };
    readonly description?: string | null;
    readonly documentEvaluationNames?: ReadonlyArray<string>;
    readonly latencyMsP50?: number | null;
    readonly latencyMsP99?: number | null;
    readonly name?: string;
    readonly spanAnnotationNames?: ReadonlyArray<string>;
    readonly timeRangeTraceCount?: number;
  };
};
export type SpansTableAsideQuery = {
  response: SpansTableAsideQuery$data;
  variables: SpansTableAsideQuery$variables;
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
  "name": "id"
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
    "variableName": "id"
  }
],
v4 = {
  "kind": "Variable",
  "name": "filterCondition",
  "variableName": "filterCondition"
},
v5 = {
  "kind": "Variable",
  "name": "timeRange",
  "variableName": "timeRange"
},
v6 = [
  (v4/*: any*/),
  (v5/*: any*/)
],
v7 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "cost",
    "storageKey": null
  }
],
v8 = {
  "kind": "InlineFragment",
  "selections": [
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
      "name": "description",
      "storageKey": null
    },
    {
      "alias": "timeRangeTraceCount",
      "args": (v6/*: any*/),
      "kind": "ScalarField",
      "name": "traceCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": (v6/*: any*/),
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
          "selections": (v7/*: any*/),
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "CostBreakdown",
          "kind": "LinkedField",
          "name": "prompt",
          "plural": false,
          "selections": (v7/*: any*/),
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "CostBreakdown",
          "kind": "LinkedField",
          "name": "completion",
          "plural": false,
          "selections": (v7/*: any*/),
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": "latencyMsP50",
      "args": [
        (v4/*: any*/),
        {
          "kind": "Literal",
          "name": "probability",
          "value": 0.5
        },
        (v5/*: any*/)
      ],
      "kind": "ScalarField",
      "name": "latencyMsQuantile",
      "storageKey": null
    },
    {
      "alias": "latencyMsP99",
      "args": [
        (v4/*: any*/),
        {
          "kind": "Literal",
          "name": "probability",
          "value": 0.99
        },
        (v5/*: any*/)
      ],
      "kind": "ScalarField",
      "name": "latencyMsQuantile",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "spanAnnotationNames",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "documentEvaluationNames",
      "storageKey": null
    }
  ],
  "type": "Project",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/),
      (v2/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "SpansTableAsideQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v3/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v8/*: any*/)
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
      (v1/*: any*/),
      (v2/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "SpansTableAsideQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v3/*: any*/),
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
          (v8/*: any*/),
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
    "cacheID": "e6417cbdc9860374a93196aaa89bf7fd",
    "id": null,
    "metadata": {},
    "name": "SpansTableAsideQuery",
    "operationKind": "query",
    "text": "query SpansTableAsideQuery(\n  $id: ID!\n  $timeRange: TimeRange!\n  $filterCondition: String\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      name\n      description\n      timeRangeTraceCount: traceCount(timeRange: $timeRange, filterCondition: $filterCondition)\n      costSummary(timeRange: $timeRange, filterCondition: $filterCondition) {\n        total {\n          cost\n        }\n        prompt {\n          cost\n        }\n        completion {\n          cost\n        }\n      }\n      latencyMsP50: latencyMsQuantile(probability: 0.5, timeRange: $timeRange, filterCondition: $filterCondition)\n      latencyMsP99: latencyMsQuantile(probability: 0.99, timeRange: $timeRange, filterCondition: $filterCondition)\n      spanAnnotationNames\n      documentEvaluationNames\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "50ef5520bd2830aadbd6bbb40300258b";

export default node;
