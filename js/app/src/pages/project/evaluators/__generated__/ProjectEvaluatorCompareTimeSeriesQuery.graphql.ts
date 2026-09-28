/**
 * @generated SignedSource<<32533832db8de3f9f80c96ac708af122>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type TimeBinScale = "DAY" | "HOUR" | "MINUTE" | "MONTH" | "WEEK" | "YEAR";
export type TimeRange = {
  end?: string | null;
  start?: string | null;
};
export type TimeBinConfig = {
  interval?: number;
  scale?: TimeBinScale;
  utcOffsetMinutes?: number;
};
export type ProjectEvaluatorCompareTimeSeriesQuery$variables = {
  annotationNameA: string;
  annotationNameB: string;
  isSession: boolean;
  isSpan: boolean;
  isTrace: boolean;
  projectId: string;
  timeBinConfig: TimeBinConfig;
  timeRange: TimeRange;
};
export type ProjectEvaluatorCompareTimeSeriesQuery$data = {
  readonly project: {
    readonly sessionA?: {
      readonly data: ReadonlyArray<{
        readonly annotationSummaries: ReadonlyArray<{
          readonly labelFractions: ReadonlyArray<{
            readonly fraction: number;
            readonly label: string;
          }>;
          readonly meanScore: number | null;
          readonly name: string;
        }>;
        readonly timestamp: string;
      }>;
    };
    readonly sessionB?: {
      readonly data: ReadonlyArray<{
        readonly annotationSummaries: ReadonlyArray<{
          readonly labelFractions: ReadonlyArray<{
            readonly fraction: number;
            readonly label: string;
          }>;
          readonly meanScore: number | null;
          readonly name: string;
        }>;
        readonly timestamp: string;
      }>;
    };
    readonly spanA?: {
      readonly data: ReadonlyArray<{
        readonly annotationSummaries: ReadonlyArray<{
          readonly labelFractions: ReadonlyArray<{
            readonly fraction: number;
            readonly label: string;
          }>;
          readonly meanScore: number | null;
          readonly name: string;
        }>;
        readonly timestamp: string;
      }>;
    };
    readonly spanB?: {
      readonly data: ReadonlyArray<{
        readonly annotationSummaries: ReadonlyArray<{
          readonly labelFractions: ReadonlyArray<{
            readonly fraction: number;
            readonly label: string;
          }>;
          readonly meanScore: number | null;
          readonly name: string;
        }>;
        readonly timestamp: string;
      }>;
    };
    readonly traceA?: {
      readonly data: ReadonlyArray<{
        readonly annotationSummaries: ReadonlyArray<{
          readonly labelFractions: ReadonlyArray<{
            readonly fraction: number;
            readonly label: string;
          }>;
          readonly meanScore: number | null;
          readonly name: string;
        }>;
        readonly timestamp: string;
      }>;
    };
    readonly traceB?: {
      readonly data: ReadonlyArray<{
        readonly annotationSummaries: ReadonlyArray<{
          readonly labelFractions: ReadonlyArray<{
            readonly fraction: number;
            readonly label: string;
          }>;
          readonly meanScore: number | null;
          readonly name: string;
        }>;
        readonly timestamp: string;
      }>;
    };
  };
};
export type ProjectEvaluatorCompareTimeSeriesQuery = {
  response: ProjectEvaluatorCompareTimeSeriesQuery$data;
  variables: ProjectEvaluatorCompareTimeSeriesQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "annotationNameA"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "annotationNameB"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "isSession"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "isSpan"
},
v4 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "isTrace"
},
v5 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "projectId"
},
v6 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeBinConfig"
},
v7 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeRange"
},
v8 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
],
v9 = {
  "kind": "Variable",
  "name": "timeBinConfig",
  "variableName": "timeBinConfig"
},
v10 = {
  "kind": "Variable",
  "name": "timeRange",
  "variableName": "timeRange"
},
v11 = [
  {
    "kind": "Variable",
    "name": "annotationName",
    "variableName": "annotationNameA"
  },
  (v9/*:: as any*/),
  (v10/*:: as any*/)
],
v12 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "AnnotationMetricsTimeSeriesDataPoint",
    "kind": "LinkedField",
    "name": "data",
    "plural": true,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "timestamp",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "AnnotationSummary",
        "kind": "LinkedField",
        "name": "annotationSummaries",
        "plural": true,
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
            "name": "meanScore",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "LabelFraction",
            "kind": "LinkedField",
            "name": "labelFractions",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "label",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "fraction",
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
v13 = [
  {
    "kind": "Variable",
    "name": "annotationName",
    "variableName": "annotationNameB"
  },
  (v9/*:: as any*/),
  (v10/*:: as any*/)
],
v14 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "condition": "isSpan",
      "kind": "Condition",
      "passingValue": true,
      "selections": [
        {
          "alias": "spanA",
          "args": (v11/*:: as any*/),
          "concreteType": "AnnotationMetricsTimeSeries",
          "kind": "LinkedField",
          "name": "spanAnnotationMetricsTimeSeries",
          "plural": false,
          "selections": (v12/*:: as any*/),
          "storageKey": null
        },
        {
          "alias": "spanB",
          "args": (v13/*:: as any*/),
          "concreteType": "AnnotationMetricsTimeSeries",
          "kind": "LinkedField",
          "name": "spanAnnotationMetricsTimeSeries",
          "plural": false,
          "selections": (v12/*:: as any*/),
          "storageKey": null
        }
      ]
    },
    {
      "condition": "isTrace",
      "kind": "Condition",
      "passingValue": true,
      "selections": [
        {
          "alias": "traceA",
          "args": (v11/*:: as any*/),
          "concreteType": "AnnotationMetricsTimeSeries",
          "kind": "LinkedField",
          "name": "traceAnnotationMetricsTimeSeries",
          "plural": false,
          "selections": (v12/*:: as any*/),
          "storageKey": null
        },
        {
          "alias": "traceB",
          "args": (v13/*:: as any*/),
          "concreteType": "AnnotationMetricsTimeSeries",
          "kind": "LinkedField",
          "name": "traceAnnotationMetricsTimeSeries",
          "plural": false,
          "selections": (v12/*:: as any*/),
          "storageKey": null
        }
      ]
    },
    {
      "condition": "isSession",
      "kind": "Condition",
      "passingValue": true,
      "selections": [
        {
          "alias": "sessionA",
          "args": (v11/*:: as any*/),
          "concreteType": "AnnotationMetricsTimeSeries",
          "kind": "LinkedField",
          "name": "sessionAnnotationMetricsTimeSeries",
          "plural": false,
          "selections": (v12/*:: as any*/),
          "storageKey": null
        },
        {
          "alias": "sessionB",
          "args": (v13/*:: as any*/),
          "concreteType": "AnnotationMetricsTimeSeries",
          "kind": "LinkedField",
          "name": "sessionAnnotationMetricsTimeSeries",
          "plural": false,
          "selections": (v12/*:: as any*/),
          "storageKey": null
        }
      ]
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
      (v3/*:: as any*/),
      (v4/*:: as any*/),
      (v5/*:: as any*/),
      (v6/*:: as any*/),
      (v7/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectEvaluatorCompareTimeSeriesQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v8/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v14/*:: as any*/)
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
      (v5/*:: as any*/),
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v7/*:: as any*/),
      (v6/*:: as any*/),
      (v3/*:: as any*/),
      (v4/*:: as any*/),
      (v2/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "ProjectEvaluatorCompareTimeSeriesQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v8/*:: as any*/),
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
          (v14/*:: as any*/),
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
    "cacheID": "fe0484a2cf97fc4884ff6856c22da378",
    "id": null,
    "metadata": {},
    "name": "ProjectEvaluatorCompareTimeSeriesQuery",
    "operationKind": "query",
    "text": "query ProjectEvaluatorCompareTimeSeriesQuery(\n  $projectId: ID!\n  $annotationNameA: String!\n  $annotationNameB: String!\n  $timeRange: TimeRange!\n  $timeBinConfig: TimeBinConfig!\n  $isSpan: Boolean!\n  $isTrace: Boolean!\n  $isSession: Boolean!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      spanA: spanAnnotationMetricsTimeSeries(annotationName: $annotationNameA, timeRange: $timeRange, timeBinConfig: $timeBinConfig) @include(if: $isSpan) {\n        data {\n          timestamp\n          annotationSummaries {\n            name\n            meanScore\n            labelFractions {\n              label\n              fraction\n            }\n          }\n        }\n      }\n      spanB: spanAnnotationMetricsTimeSeries(annotationName: $annotationNameB, timeRange: $timeRange, timeBinConfig: $timeBinConfig) @include(if: $isSpan) {\n        data {\n          timestamp\n          annotationSummaries {\n            name\n            meanScore\n            labelFractions {\n              label\n              fraction\n            }\n          }\n        }\n      }\n      traceA: traceAnnotationMetricsTimeSeries(annotationName: $annotationNameA, timeRange: $timeRange, timeBinConfig: $timeBinConfig) @include(if: $isTrace) {\n        data {\n          timestamp\n          annotationSummaries {\n            name\n            meanScore\n            labelFractions {\n              label\n              fraction\n            }\n          }\n        }\n      }\n      traceB: traceAnnotationMetricsTimeSeries(annotationName: $annotationNameB, timeRange: $timeRange, timeBinConfig: $timeBinConfig) @include(if: $isTrace) {\n        data {\n          timestamp\n          annotationSummaries {\n            name\n            meanScore\n            labelFractions {\n              label\n              fraction\n            }\n          }\n        }\n      }\n      sessionA: sessionAnnotationMetricsTimeSeries(annotationName: $annotationNameA, timeRange: $timeRange, timeBinConfig: $timeBinConfig) @include(if: $isSession) {\n        data {\n          timestamp\n          annotationSummaries {\n            name\n            meanScore\n            labelFractions {\n              label\n              fraction\n            }\n          }\n        }\n      }\n      sessionB: sessionAnnotationMetricsTimeSeries(annotationName: $annotationNameB, timeRange: $timeRange, timeBinConfig: $timeBinConfig) @include(if: $isSession) {\n        data {\n          timestamp\n          annotationSummaries {\n            name\n            meanScore\n            labelFractions {\n              label\n              fraction\n            }\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "e5df1a208bc92741f90a539462d145f6";

export default node;
