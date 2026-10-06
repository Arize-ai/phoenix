/**
 * @generated SignedSource<<7de3a12434ca04bc4fd6fb86335cc3d7>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ExperimentAnnotationMetricQuery$variables = {
  annotationName: string;
  count: number;
  filterIds?: ReadonlyArray<string> | null;
  id: string;
  isComparedSelection: boolean;
};
export type ExperimentAnnotationMetricQuery$data = {
  readonly dataset: {
    readonly baselineExperiment?: {
      readonly " $fragmentSpreads": FragmentRefs<"ExperimentAnnotationMetric_experiment">;
    } | null;
    readonly metricsExperiments?: {
      readonly edges: ReadonlyArray<{
        readonly experiment: {
          readonly " $fragmentSpreads": FragmentRefs<"ExperimentAnnotationMetric_experiment">;
        };
      }>;
    };
  };
};
export type ExperimentAnnotationMetricQuery = {
  response: ExperimentAnnotationMetricQuery$data;
  variables: ExperimentAnnotationMetricQuery$variables;
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
  "name": "count"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "filterIds"
},
v3 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "id"
},
v4 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "isComparedSelection"
},
v5 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v7 = [
  {
    "kind": "Variable",
    "name": "annotationName",
    "variableName": "annotationName"
  }
],
v8 = [
  (v6/*:: as any*/),
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
    "name": "sequenceNumber",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "isBaseline",
    "storageKey": null
  },
  {
    "alias": null,
    "args": (v7/*:: as any*/),
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
v9 = [
  {
    "kind": "InlineDataFragmentSpread",
    "name": "ExperimentAnnotationMetric_experiment",
    "selections": (v8/*:: as any*/),
    "args": (v7/*:: as any*/),
    "argumentDefinitions": [
      (v0/*:: as any*/)
    ]
  }
],
v10 = [
  {
    "kind": "Variable",
    "name": "filterIds",
    "variableName": "filterIds"
  },
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "count"
  },
  {
    "kind": "Variable",
    "name": "includeEphemeral",
    "variableName": "isComparedSelection"
  }
];
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
    "name": "ExperimentAnnotationMetricQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v5/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "condition": "isComparedSelection",
                "kind": "Condition",
                "passingValue": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Experiment",
                    "kind": "LinkedField",
                    "name": "baselineExperiment",
                    "plural": false,
                    "selections": (v9/*:: as any*/),
                    "storageKey": null
                  }
                ]
              },
              {
                "alias": "metricsExperiments",
                "args": (v10/*:: as any*/),
                "concreteType": "ExperimentConnection",
                "kind": "LinkedField",
                "name": "experiments",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ExperimentEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": "experiment",
                        "args": null,
                        "concreteType": "Experiment",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": (v9/*:: as any*/),
                        "storageKey": null
                      }
                    ],
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
      (v3/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/),
      (v4/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "ExperimentAnnotationMetricQuery",
    "selections": [
      {
        "alias": "dataset",
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
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "condition": "isComparedSelection",
                "kind": "Condition",
                "passingValue": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "Experiment",
                    "kind": "LinkedField",
                    "name": "baselineExperiment",
                    "plural": false,
                    "selections": (v8/*:: as any*/),
                    "storageKey": null
                  }
                ]
              },
              {
                "alias": "metricsExperiments",
                "args": (v10/*:: as any*/),
                "concreteType": "ExperimentConnection",
                "kind": "LinkedField",
                "name": "experiments",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ExperimentEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": "experiment",
                        "args": null,
                        "concreteType": "Experiment",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": (v8/*:: as any*/),
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "Dataset",
            "abstractKey": null
          },
          (v6/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "d481ab5f925a71339de0ebc43a618855",
    "id": null,
    "metadata": {},
    "name": "ExperimentAnnotationMetricQuery",
    "operationKind": "query",
    "text": "query ExperimentAnnotationMetricQuery(\n  $id: ID!\n  $count: Int!\n  $filterIds: [ID!]\n  $isComparedSelection: Boolean!\n  $annotationName: String!\n) {\n  dataset: node(id: $id) {\n    __typename\n    ... on Dataset {\n      baselineExperiment @skip(if: $isComparedSelection) {\n        ...ExperimentAnnotationMetric_experiment_3VbSQz\n        id\n      }\n      metricsExperiments: experiments(first: $count, filterIds: $filterIds, includeEphemeral: $isComparedSelection) {\n        edges {\n          experiment: node {\n            ...ExperimentAnnotationMetric_experiment_3VbSQz\n            id\n          }\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment ExperimentAnnotationMetric_experiment_3VbSQz on Experiment {\n  id\n  name\n  sequenceNumber\n  isBaseline\n  annotationSummaries(annotationName: $annotationName) {\n    annotationName\n    meanScore\n    labelFractions {\n      label\n      fraction\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "942bb241752b387a7f0dda4adf4f2748";

export default node;
