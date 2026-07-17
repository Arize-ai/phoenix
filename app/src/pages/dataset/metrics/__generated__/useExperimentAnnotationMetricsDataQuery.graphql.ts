/**
 * @generated SignedSource<<dcbef4a047cff04eaaf235af26def868>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type useExperimentAnnotationMetricsDataQuery$variables = {
  count: number;
  id: string;
};
export type useExperimentAnnotationMetricsDataQuery$data = {
  readonly dataset: {
    readonly experimentAnnotationMetrics?: {
      readonly baselineExperiment: {
        readonly " $fragmentSpreads": FragmentRefs<"useExperimentAnnotationMetricsData_dataPoint">;
      } | null;
      readonly recentExperiments: ReadonlyArray<{
        readonly " $fragmentSpreads": FragmentRefs<"useExperimentAnnotationMetricsData_dataPoint">;
      }>;
    };
  };
};
export type useExperimentAnnotationMetricsDataQuery = {
  response: useExperimentAnnotationMetricsDataQuery$data;
  variables: useExperimentAnnotationMetricsDataQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "count"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "id"
},
v2 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v3 = [
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "count"
  }
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v6 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "Experiment",
    "kind": "LinkedField",
    "name": "experiment",
    "plural": false,
    "selections": [
      (v4/*:: as any*/),
      (v5/*:: as any*/),
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "sequenceNumber",
        "storageKey": null
      }
    ],
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
      (v5/*:: as any*/),
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
v7 = [
  {
    "kind": "InlineDataFragmentSpread",
    "name": "useExperimentAnnotationMetricsData_dataPoint",
    "selections": (v6/*:: as any*/),
    "args": null,
    "argumentDefinitions": ([]/*:: as any*/)
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "useExperimentAnnotationMetricsDataQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v2/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": (v3/*:: as any*/),
                "concreteType": "ExperimentAnnotationMetrics",
                "kind": "LinkedField",
                "name": "experimentAnnotationMetrics",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ExperimentAnnotationMetricsDataPoint",
                    "kind": "LinkedField",
                    "name": "baselineExperiment",
                    "plural": false,
                    "selections": (v7/*:: as any*/),
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ExperimentAnnotationMetricsDataPoint",
                    "kind": "LinkedField",
                    "name": "recentExperiments",
                    "plural": true,
                    "selections": (v7/*:: as any*/),
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "Dataset",
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
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "useExperimentAnnotationMetricsDataQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v2/*:: as any*/),
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
              {
                "alias": null,
                "args": (v3/*:: as any*/),
                "concreteType": "ExperimentAnnotationMetrics",
                "kind": "LinkedField",
                "name": "experimentAnnotationMetrics",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ExperimentAnnotationMetricsDataPoint",
                    "kind": "LinkedField",
                    "name": "baselineExperiment",
                    "plural": false,
                    "selections": (v6/*:: as any*/),
                    "storageKey": null
                  },
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ExperimentAnnotationMetricsDataPoint",
                    "kind": "LinkedField",
                    "name": "recentExperiments",
                    "plural": true,
                    "selections": (v6/*:: as any*/),
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "Dataset",
            "abstractKey": null
          },
          (v4/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "a13e2254359e29b80b95eee30ed184cf",
    "id": null,
    "metadata": {},
    "name": "useExperimentAnnotationMetricsDataQuery",
    "operationKind": "query",
    "text": "query useExperimentAnnotationMetricsDataQuery(\n  $id: ID!\n  $count: Int!\n) {\n  dataset: node(id: $id) {\n    __typename\n    ... on Dataset {\n      experimentAnnotationMetrics(first: $count) {\n        baselineExperiment {\n          ...useExperimentAnnotationMetricsData_dataPoint\n        }\n        recentExperiments {\n          ...useExperimentAnnotationMetricsData_dataPoint\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment useExperimentAnnotationMetricsData_dataPoint on ExperimentAnnotationMetricsDataPoint {\n  experiment {\n    id\n    name\n    sequenceNumber\n  }\n  annotationSummaries {\n    name\n    meanScore\n    labelFractions {\n      label\n      fraction\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "f76f77aaa218b2fd21003ab4c27a30f4";

export default node;
