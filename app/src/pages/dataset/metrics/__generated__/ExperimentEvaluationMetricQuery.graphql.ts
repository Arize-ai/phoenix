/**
 * @generated SignedSource<<8c6999c345e6cc826d8271e95fa0e54e>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ExperimentEvaluationMetricQuery$variables = {
  annotationName: string;
  count: number;
  id: string;
};
export type ExperimentEvaluationMetricQuery$data = {
  readonly dataset: {
    readonly baselineExperiment?: {
      readonly " $fragmentSpreads": FragmentRefs<"ExperimentEvaluationMetric_experiment">;
    } | null;
    readonly metricsExperiments?: {
      readonly edges: ReadonlyArray<{
        readonly experiment: {
          readonly " $fragmentSpreads": FragmentRefs<"ExperimentEvaluationMetric_experiment">;
        };
      }>;
    };
  };
};
export type ExperimentEvaluationMetricQuery = {
  response: ExperimentEvaluationMetricQuery$data;
  variables: ExperimentEvaluationMetricQuery$variables;
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
  "name": "id"
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
  "name": "id",
  "storageKey": null
},
v5 = [
  {
    "kind": "Variable",
    "name": "annotationName",
    "variableName": "annotationName"
  }
],
v6 = [
  (v4/*:: as any*/),
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
    "args": (v5/*:: as any*/),
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
v7 = [
  {
    "kind": "InlineDataFragmentSpread",
    "name": "ExperimentEvaluationMetric_experiment",
    "selections": (v6/*:: as any*/),
    "args": (v5/*:: as any*/),
    "argumentDefinitions": [
      (v0/*:: as any*/)
    ]
  }
],
v8 = [
  {
    "kind": "Variable",
    "name": "first",
    "variableName": "count"
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "ExperimentEvaluationMetricQuery",
    "selections": [
      {
        "alias": "dataset",
        "args": (v3/*:: as any*/),
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
                "args": null,
                "concreteType": "Experiment",
                "kind": "LinkedField",
                "name": "baselineExperiment",
                "plural": false,
                "selections": (v7/*:: as any*/),
                "storageKey": null
              },
              {
                "alias": "metricsExperiments",
                "args": (v8/*:: as any*/),
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
                        "selections": (v7/*:: as any*/),
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
      (v2/*:: as any*/),
      (v1/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "ExperimentEvaluationMetricQuery",
    "selections": [
      {
        "alias": "dataset",
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
              {
                "alias": null,
                "args": null,
                "concreteType": "Experiment",
                "kind": "LinkedField",
                "name": "baselineExperiment",
                "plural": false,
                "selections": (v6/*:: as any*/),
                "storageKey": null
              },
              {
                "alias": "metricsExperiments",
                "args": (v8/*:: as any*/),
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
                        "selections": (v6/*:: as any*/),
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
          (v4/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "d011be24cc1ad99e682eec9592371896",
    "id": null,
    "metadata": {},
    "name": "ExperimentEvaluationMetricQuery",
    "operationKind": "query",
    "text": "query ExperimentEvaluationMetricQuery(\n  $id: ID!\n  $count: Int!\n  $annotationName: String!\n) {\n  dataset: node(id: $id) {\n    __typename\n    ... on Dataset {\n      baselineExperiment {\n        ...ExperimentEvaluationMetric_experiment_3VbSQz\n        id\n      }\n      metricsExperiments: experiments(first: $count) {\n        edges {\n          experiment: node {\n            ...ExperimentEvaluationMetric_experiment_3VbSQz\n            id\n          }\n        }\n      }\n    }\n    id\n  }\n}\n\nfragment ExperimentEvaluationMetric_experiment_3VbSQz on Experiment {\n  id\n  name\n  sequenceNumber\n  annotationSummaries(annotationName: $annotationName) {\n    annotationName\n    meanScore\n    labelFractions {\n      label\n      fraction\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "4da8c0734c31bf10ba3616a8b29f42ee";

export default node;
