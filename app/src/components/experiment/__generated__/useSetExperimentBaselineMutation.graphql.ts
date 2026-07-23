/**
 * @generated SignedSource<<20bcfb1b47052688dae3dabc6a6bd137>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type useSetExperimentBaselineMutation$variables = {
  baseline: boolean;
  experimentId: string;
};
export type useSetExperimentBaselineMutation$data = {
  readonly setExperimentBaseline: {
    readonly dataset: {
      readonly baselineExperiment: {
        readonly " $fragmentSpreads": FragmentRefs<"useExperimentMetricsData_experiment">;
      } | null;
      readonly id: string;
    };
    readonly experiment: {
      readonly id: string;
      readonly isBaseline: boolean;
    };
    readonly previousBaselineExperiment: {
      readonly id: string;
      readonly isBaseline: boolean;
    } | null;
  };
};
export type useSetExperimentBaselineMutation = {
  response: useSetExperimentBaselineMutation$data;
  variables: useSetExperimentBaselineMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "baseline"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "experimentId"
},
v2 = [
  {
    "kind": "Variable",
    "name": "baseline",
    "variableName": "baseline"
  },
  {
    "kind": "Variable",
    "name": "experimentId",
    "variableName": "experimentId"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "tokens",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "cost",
    "storageKey": null
  }
],
v5 = [
  (v3/*:: as any*/),
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
    "name": "averageRunLatencyMs",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "errorRate",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "runCount",
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
        "name": "prompt",
        "plural": false,
        "selections": (v4/*:: as any*/),
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "CostBreakdown",
        "kind": "LinkedField",
        "name": "completion",
        "plural": false,
        "selections": (v4/*:: as any*/),
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "CostBreakdown",
        "kind": "LinkedField",
        "name": "total",
        "plural": false,
        "selections": (v4/*:: as any*/),
        "storageKey": null
      }
    ],
    "storageKey": null
  }
],
v6 = [
  (v3/*:: as any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "isBaseline",
    "storageKey": null
  }
],
v7 = {
  "alias": null,
  "args": null,
  "concreteType": "Experiment",
  "kind": "LinkedField",
  "name": "experiment",
  "plural": false,
  "selections": (v6/*:: as any*/),
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "concreteType": "Experiment",
  "kind": "LinkedField",
  "name": "previousBaselineExperiment",
  "plural": false,
  "selections": (v6/*:: as any*/),
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "useSetExperimentBaselineMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "SetExperimentBaselinePayload",
        "kind": "LinkedField",
        "name": "setExperimentBaseline",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Dataset",
            "kind": "LinkedField",
            "name": "dataset",
            "plural": false,
            "selections": [
              (v3/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "Experiment",
                "kind": "LinkedField",
                "name": "baselineExperiment",
                "plural": false,
                "selections": [
                  {
                    "kind": "InlineDataFragmentSpread",
                    "name": "useExperimentMetricsData_experiment",
                    "selections": (v5/*:: as any*/),
                    "args": null,
                    "argumentDefinitions": []
                  }
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          (v7/*:: as any*/),
          (v8/*:: as any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "useSetExperimentBaselineMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "SetExperimentBaselinePayload",
        "kind": "LinkedField",
        "name": "setExperimentBaseline",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Dataset",
            "kind": "LinkedField",
            "name": "dataset",
            "plural": false,
            "selections": [
              (v3/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "concreteType": "Experiment",
                "kind": "LinkedField",
                "name": "baselineExperiment",
                "plural": false,
                "selections": (v5/*:: as any*/),
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          (v7/*:: as any*/),
          (v8/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "0953733971b12b6c99dadcfa479db250",
    "id": null,
    "metadata": {},
    "name": "useSetExperimentBaselineMutation",
    "operationKind": "mutation",
    "text": "mutation useSetExperimentBaselineMutation(\n  $experimentId: ID!\n  $baseline: Boolean!\n) {\n  setExperimentBaseline(experimentId: $experimentId, baseline: $baseline) {\n    dataset {\n      id\n      baselineExperiment {\n        ...useExperimentMetricsData_experiment\n        id\n      }\n    }\n    experiment {\n      id\n      isBaseline\n    }\n    previousBaselineExperiment {\n      id\n      isBaseline\n    }\n  }\n}\n\nfragment useExperimentMetricsData_experiment on Experiment {\n  id\n  name\n  sequenceNumber\n  averageRunLatencyMs\n  errorRate\n  runCount\n  annotationSummaries {\n    annotationName\n    meanScore\n    labelFractions {\n      label\n      fraction\n    }\n  }\n  costSummary {\n    prompt {\n      tokens\n      cost\n    }\n    completion {\n      tokens\n      cost\n    }\n    total {\n      tokens\n      cost\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "ad200d7ba495436e217aff50c32a769f";

export default node;
