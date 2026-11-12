/**
 * @generated SignedSource<<a3f1aaf95de1d7c62b0900f0ab85dd47>>
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
    readonly timeRangeTraceCount?: number;
    readonly traceAnnotationNames?: ReadonlyArray<string>;
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
  (v4/*:: as any*/),
  (v5/*:: as any*/)
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
      "args": (v6/*:: as any*/),
      "kind": "ScalarField",
      "name": "traceCount",
      "storageKey": null
    },
    {
      "alias": null,
      "args": (v6/*:: as any*/),
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
          "selections": (v7/*:: as any*/),
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "CostBreakdown",
          "kind": "LinkedField",
          "name": "prompt",
          "plural": false,
          "selections": (v7/*:: as any*/),
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "CostBreakdown",
          "kind": "LinkedField",
          "name": "completion",
          "plural": false,
          "selections": (v7/*:: as any*/),
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": "latencyMsP50",
      "args": [
        (v4/*:: as any*/),
        {
          "kind": "Literal",
          "name": "probability",
          "value": 0.5
        },
        (v5/*:: as any*/)
      ],
      "kind": "ScalarField",
      "name": "latencyMsQuantile",
      "storageKey": null
    },
    {
      "alias": "latencyMsP99",
      "args": [
        (v4/*:: as any*/),
        {
          "kind": "Literal",
          "name": "probability",
          "value": 0.99
        },
        (v5/*:: as any*/)
      ],
      "kind": "ScalarField",
      "name": "latencyMsQuantile",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "traceAnnotationNames",
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
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "SpansTableAsideQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v3/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v8/*:: as any*/)
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
    "name": "SpansTableAsideQuery",
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
          (v8/*:: as any*/),
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
    "cacheID": "f7c335ee496dd033b1d856ee6062de53",
    "id": null,
    "metadata": {},
    "name": "SpansTableAsideQuery",
    "operationKind": "query",
    "text": "query SpansTableAsideQuery(\n  $id: ID!\n  $timeRange: TimeRange!\n  $filterCondition: String\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      name\n      description\n      timeRangeTraceCount: traceCount(timeRange: $timeRange, filterCondition: $filterCondition)\n      costSummary(timeRange: $timeRange, filterCondition: $filterCondition) {\n        total {\n          cost\n        }\n        prompt {\n          cost\n        }\n        completion {\n          cost\n        }\n      }\n      latencyMsP50: latencyMsQuantile(probability: 0.5, timeRange: $timeRange, filterCondition: $filterCondition)\n      latencyMsP99: latencyMsQuantile(probability: 0.99, timeRange: $timeRange, filterCondition: $filterCondition)\n      traceAnnotationNames\n      documentEvaluationNames\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "75111c8307694de09eff4c74d1a4fbc2";

export default node;
