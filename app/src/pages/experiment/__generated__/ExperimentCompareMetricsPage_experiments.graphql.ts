/**
 * @generated SignedSource<<b3bf013208384f9c04f5a93b32b8c801>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ExperimentCompareMetricsPage_experiments$data = {
  readonly baseExperiment: {
    readonly annotationSummaries?: ReadonlyArray<{
      readonly annotationName: string;
      readonly meanScore: number | null;
    }>;
    readonly averageRunLatencyMs?: number | null;
    readonly costSummary?: {
      readonly completion: {
        readonly tokens: number | null;
      };
      readonly prompt: {
        readonly tokens: number | null;
      };
      readonly total: {
        readonly cost: number | null;
        readonly tokens: number | null;
      };
    };
    readonly id?: string;
  };
  readonly firstCompareExperiment?: {
    readonly annotationSummaries?: ReadonlyArray<{
      readonly annotationName: string;
      readonly meanScore: number | null;
    }>;
    readonly averageRunLatencyMs?: number | null;
    readonly costSummary?: {
      readonly completion: {
        readonly tokens: number | null;
      };
      readonly prompt: {
        readonly tokens: number | null;
      };
      readonly total: {
        readonly cost: number | null;
        readonly tokens: number | null;
      };
    };
    readonly id?: string;
  };
  readonly secondCompareExperiment?: {
    readonly annotationSummaries?: ReadonlyArray<{
      readonly annotationName: string;
      readonly meanScore: number | null;
    }>;
    readonly averageRunLatencyMs?: number | null;
    readonly costSummary?: {
      readonly completion: {
        readonly tokens: number | null;
      };
      readonly prompt: {
        readonly tokens: number | null;
      };
      readonly total: {
        readonly cost: number | null;
        readonly tokens: number | null;
      };
    };
    readonly id?: string;
  };
  readonly thirdCompareExperiment?: {
    readonly annotationSummaries?: ReadonlyArray<{
      readonly annotationName: string;
      readonly meanScore: number | null;
    }>;
    readonly averageRunLatencyMs?: number | null;
    readonly costSummary?: {
      readonly completion: {
        readonly tokens: number | null;
      };
      readonly prompt: {
        readonly tokens: number | null;
      };
      readonly total: {
        readonly cost: number | null;
        readonly tokens: number | null;
      };
    };
    readonly id?: string;
  };
  readonly " $fragmentType": "ExperimentCompareMetricsPage_experiments";
};
export type ExperimentCompareMetricsPage_experiments$key = {
  readonly " $data"?: ExperimentCompareMetricsPage_experiments$data;
  readonly " $fragmentSpreads": FragmentRefs<"ExperimentCompareMetricsPage_experiments">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "tokens",
  "storageKey": null
},
v1 = [
  (v0/*: any*/)
],
v2 = [
  {
    "kind": "InlineFragment",
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "id",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "averageRunLatencyMs",
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
              (v0/*: any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "cost",
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "CostBreakdown",
            "kind": "LinkedField",
            "name": "prompt",
            "plural": false,
            "selections": (v1/*: any*/),
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "CostBreakdown",
            "kind": "LinkedField",
            "name": "completion",
            "plural": false,
            "selections": (v1/*: any*/),
            "storageKey": null
          }
        ],
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "ExperimentAnnotationSummary",
        "kind": "LinkedField",
        "name": "annotationSummaries",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "annotationName",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "meanScore",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Experiment",
    "abstractKey": null
  }
];
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "baseExperimentId"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "firstCompareExperimentId"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "hasFirstCompareExperiment"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "hasSecondCompareExperiment"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "hasThirdCompareExperiment"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "secondCompareExperimentId"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "thirdCompareExperimentId"
    }
  ],
  "kind": "Fragment",
  "metadata": null,
  "name": "ExperimentCompareMetricsPage_experiments",
  "selections": [
    {
      "alias": "baseExperiment",
      "args": [
        {
          "kind": "Variable",
          "name": "id",
          "variableName": "baseExperimentId"
        }
      ],
      "concreteType": null,
      "kind": "LinkedField",
      "name": "node",
      "plural": false,
      "selections": (v2/*: any*/),
      "storageKey": null
    },
    {
      "condition": "hasFirstCompareExperiment",
      "kind": "Condition",
      "passingValue": true,
      "selections": [
        {
          "alias": "firstCompareExperiment",
          "args": [
            {
              "kind": "Variable",
              "name": "id",
              "variableName": "firstCompareExperimentId"
            }
          ],
          "concreteType": null,
          "kind": "LinkedField",
          "name": "node",
          "plural": false,
          "selections": (v2/*: any*/),
          "storageKey": null
        }
      ]
    },
    {
      "condition": "hasSecondCompareExperiment",
      "kind": "Condition",
      "passingValue": true,
      "selections": [
        {
          "alias": "secondCompareExperiment",
          "args": [
            {
              "kind": "Variable",
              "name": "id",
              "variableName": "secondCompareExperimentId"
            }
          ],
          "concreteType": null,
          "kind": "LinkedField",
          "name": "node",
          "plural": false,
          "selections": (v2/*: any*/),
          "storageKey": null
        }
      ]
    },
    {
      "condition": "hasThirdCompareExperiment",
      "kind": "Condition",
      "passingValue": true,
      "selections": [
        {
          "alias": "thirdCompareExperiment",
          "args": [
            {
              "kind": "Variable",
              "name": "id",
              "variableName": "thirdCompareExperimentId"
            }
          ],
          "concreteType": null,
          "kind": "LinkedField",
          "name": "node",
          "plural": false,
          "selections": (v2/*: any*/),
          "storageKey": null
        }
      ]
    }
  ],
  "type": "Query",
  "abstractKey": null
};
})();

(node as any).hash = "b1a30ab837f3101072954def6a1854f5";

export default node;
