/**
 * @generated SignedSource<<3380c9e4eeec0170ce6a73307eaeedec>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
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
    readonly description?: string | null;
    readonly documentEvaluationNames?: ReadonlyArray<string>;
    readonly name?: string;
    readonly traceAnnotationNames?: ReadonlyArray<string>;
    readonly " $fragmentSpreads": FragmentRefs<"SpansTableAside_stats">;
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
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v6 = {
  "kind": "Variable",
  "name": "filterCondition",
  "variableName": "filterCondition"
},
v7 = {
  "kind": "Variable",
  "name": "timeRange",
  "variableName": "timeRange"
},
v8 = [
  (v6/*:: as any*/),
  (v7/*:: as any*/)
],
v9 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "cost",
    "storageKey": null
  }
],
v10 = [
  {
    "alias": "timeRangeTraceCount",
    "args": (v8/*:: as any*/),
    "kind": "ScalarField",
    "name": "traceCount",
    "storageKey": null
  },
  {
    "alias": null,
    "args": (v8/*:: as any*/),
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
        "selections": (v9/*:: as any*/),
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "CostBreakdown",
        "kind": "LinkedField",
        "name": "prompt",
        "plural": false,
        "selections": (v9/*:: as any*/),
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "CostBreakdown",
        "kind": "LinkedField",
        "name": "completion",
        "plural": false,
        "selections": (v9/*:: as any*/),
        "storageKey": null
      }
    ],
    "storageKey": null
  },
  {
    "alias": "latencyMsP50",
    "args": [
      (v6/*:: as any*/),
      {
        "kind": "Literal",
        "name": "probability",
        "value": 0.5
      },
      (v7/*:: as any*/)
    ],
    "kind": "ScalarField",
    "name": "latencyMsQuantile",
    "storageKey": null
  },
  {
    "alias": "latencyMsP99",
    "args": [
      (v6/*:: as any*/),
      {
        "kind": "Literal",
        "name": "probability",
        "value": 0.99
      },
      (v7/*:: as any*/)
    ],
    "kind": "ScalarField",
    "name": "latencyMsQuantile",
    "storageKey": null
  }
],
v11 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "traceAnnotationNames",
  "storageKey": null
},
v12 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "documentEvaluationNames",
  "storageKey": null
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
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              {
                "kind": "Defer",
                "selections": [
                  {
                    "kind": "InlineDataFragmentSpread",
                    "name": "SpansTableAside_stats",
                    "selections": (v10/*:: as any*/),
                    "args": null,
                    "argumentDefinitions": [
                      {
                        "kind": "RootArgument",
                        "name": "filterCondition"
                      },
                      {
                        "kind": "RootArgument",
                        "name": "timeRange"
                      }
                    ]
                  }
                ]
              },
              (v11/*:: as any*/),
              (v12/*:: as any*/)
            ],
            "type": "Project",
            "abstractKey": null
          }
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
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              {
                "if": null,
                "kind": "Defer",
                "label": "SpansTableAsideQuery$defer$SpansTableAside_stats",
                "selections": (v10/*:: as any*/)
              },
              (v11/*:: as any*/),
              (v12/*:: as any*/)
            ],
            "type": "Project",
            "abstractKey": null
          },
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
    "cacheID": "1bcd67c1749d46aad16d66c7478c2966",
    "id": null,
    "metadata": {},
    "name": "SpansTableAsideQuery",
    "operationKind": "query",
    "text": "query SpansTableAsideQuery(\n  $id: ID!\n  $timeRange: TimeRange!\n  $filterCondition: String\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      name\n      description\n      ...SpansTableAside_stats @defer(label: \"SpansTableAsideQuery$defer$SpansTableAside_stats\")\n      traceAnnotationNames\n      documentEvaluationNames\n    }\n    id\n  }\n}\n\nfragment SpansTableAside_stats on Project {\n  timeRangeTraceCount: traceCount(timeRange: $timeRange, filterCondition: $filterCondition)\n  costSummary(timeRange: $timeRange, filterCondition: $filterCondition) {\n    total {\n      cost\n    }\n    prompt {\n      cost\n    }\n    completion {\n      cost\n    }\n  }\n  latencyMsP50: latencyMsQuantile(probability: 0.5, timeRange: $timeRange, filterCondition: $filterCondition)\n  latencyMsP99: latencyMsQuantile(probability: 0.99, timeRange: $timeRange, filterCondition: $filterCondition)\n}\n"
  }
};
})();

(node as any).hash = "dc34be07c545adc5e4360788b707a8c9";

export default node;
