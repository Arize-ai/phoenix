/**
 * @generated SignedSource<<226c56c2ee0275d2e28740cb5f6fe3ac>>
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
  scale?: TimeBinScale;
  utcOffsetMinutes?: number;
};
export type ProjectEvaluatorMeanScoreCellSpanQuery$variables = {
  annotationName: string;
  previousTimeRange: TimeRange;
  projectId: string;
  timeBinConfig: TimeBinConfig;
  timeRange: TimeRange;
};
export type ProjectEvaluatorMeanScoreCellSpanQuery$data = {
  readonly project: {
    readonly previousSummary?: {
      readonly meanScore: number | null;
    } | null;
    readonly series?: {
      readonly data: ReadonlyArray<{
        readonly annotationSummaries: ReadonlyArray<{
          readonly meanScore: number | null;
          readonly name: string;
        }>;
      }>;
    };
    readonly summary?: {
      readonly count: number;
      readonly labelCount: number;
      readonly labelFractions: ReadonlyArray<{
        readonly fraction: number;
        readonly label: string;
      }>;
      readonly meanScore: number | null;
      readonly scoreCount: number;
    } | null;
  };
};
export type ProjectEvaluatorMeanScoreCellSpanQuery = {
  response: ProjectEvaluatorMeanScoreCellSpanQuery$data;
  variables: ProjectEvaluatorMeanScoreCellSpanQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "annotationName"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "previousTimeRange"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "projectId"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeBinConfig"
},
v4 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "timeRange"
},
v5 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
],
v6 = {
  "kind": "Variable",
  "name": "annotationName",
  "variableName": "annotationName"
},
v7 = {
  "kind": "Variable",
  "name": "timeRange",
  "variableName": "timeRange"
},
v8 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "meanScore",
  "storageKey": null
},
v9 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": "summary",
      "args": [
        (v6/*:: as any*/),
        (v7/*:: as any*/)
      ],
      "concreteType": "AnnotationSummary",
      "kind": "LinkedField",
      "name": "spanAnnotationSummary",
      "plural": false,
      "selections": [
        (v8/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "count",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "scoreCount",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "labelCount",
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
    },
    {
      "alias": "previousSummary",
      "args": [
        (v6/*:: as any*/),
        {
          "kind": "Variable",
          "name": "timeRange",
          "variableName": "previousTimeRange"
        }
      ],
      "concreteType": "AnnotationSummary",
      "kind": "LinkedField",
      "name": "spanAnnotationSummary",
      "plural": false,
      "selections": [
        (v8/*:: as any*/)
      ],
      "storageKey": null
    },
    {
      "alias": "series",
      "args": [
        (v6/*:: as any*/),
        {
          "kind": "Variable",
          "name": "timeBinConfig",
          "variableName": "timeBinConfig"
        },
        (v7/*:: as any*/)
      ],
      "concreteType": "AnnotationMetricsTimeSeries",
      "kind": "LinkedField",
      "name": "spanAnnotationMetricsTimeSeries",
      "plural": false,
      "selections": [
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
                (v8/*:: as any*/)
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
      (v4/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectEvaluatorMeanScoreCellSpanQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v5/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v9/*:: as any*/)
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
      (v4/*:: as any*/),
      (v1/*:: as any*/),
      (v3/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "ProjectEvaluatorMeanScoreCellSpanQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v5/*:: as any*/),
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
          (v9/*:: as any*/),
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
    "cacheID": "c96b304033374707e95c83bf48ff7499",
    "id": null,
    "metadata": {},
    "name": "ProjectEvaluatorMeanScoreCellSpanQuery",
    "operationKind": "query",
    "text": "query ProjectEvaluatorMeanScoreCellSpanQuery(\n  $projectId: ID!\n  $annotationName: String!\n  $timeRange: TimeRange!\n  $previousTimeRange: TimeRange!\n  $timeBinConfig: TimeBinConfig!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      summary: spanAnnotationSummary(annotationName: $annotationName, timeRange: $timeRange) {\n        meanScore\n        count\n        scoreCount\n        labelCount\n        labelFractions {\n          label\n          fraction\n        }\n      }\n      previousSummary: spanAnnotationSummary(annotationName: $annotationName, timeRange: $previousTimeRange) {\n        meanScore\n      }\n      series: spanAnnotationMetricsTimeSeries(annotationName: $annotationName, timeRange: $timeRange, timeBinConfig: $timeBinConfig) {\n        data {\n          annotationSummaries {\n            name\n            meanScore\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "200468cb2d30608b0175fafeec0e5872";

export default node;
