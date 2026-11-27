/**
 * @generated SignedSource<<6249c40add2e78d0c364901e51383d3a>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type useExperimentCompareLaneRunGroupQuery$variables = {
  exampleId: string;
  experimentIds: ReadonlyArray<string>;
};
export type useExperimentCompareLaneRunGroupQuery$data = {
  readonly example: {
    readonly experimentRepeatedRunGroups?: ReadonlyArray<{
      readonly " $fragmentSpreads": FragmentRefs<"useExperimentCompareLaneRunGroup_runGroup">;
    }>;
  };
};
export type useExperimentCompareLaneRunGroupQuery = {
  response: useExperimentCompareLaneRunGroupQuery$data;
  variables: useExperimentCompareLaneRunGroupQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "exampleId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "experimentIds"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "exampleId"
  }
],
v2 = [
  {
    "kind": "Variable",
    "name": "experimentIds",
    "variableName": "experimentIds"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
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
      "storageKey": null
    }
  ],
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "concreteType": "Trace",
  "kind": "LinkedField",
  "name": "trace",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "traceId",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "projectId",
      "storageKey": null
    },
    (v3/*:: as any*/)
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "useExperimentCompareLaneRunGroupQuery",
    "selections": [
      {
        "alias": "example",
        "args": (v1/*:: as any*/),
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
                "args": (v2/*:: as any*/),
                "concreteType": "ExperimentRepeatedRunGroup",
                "kind": "LinkedField",
                "name": "experimentRepeatedRunGroups",
                "plural": true,
                "selections": [
                  {
                    "args": null,
                    "kind": "FragmentSpread",
                    "name": "useExperimentCompareLaneRunGroup_runGroup"
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "DatasetExample",
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "useExperimentCompareLaneRunGroupQuery",
    "selections": [
      {
        "alias": "example",
        "args": (v1/*:: as any*/),
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
                "args": (v2/*:: as any*/),
                "concreteType": "ExperimentRepeatedRunGroup",
                "kind": "LinkedField",
                "name": "experimentRepeatedRunGroups",
                "plural": true,
                "selections": [
                  (v3/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "averageLatencyMs",
                    "storageKey": null
                  },
                  (v4/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "ExperimentRun",
                    "kind": "LinkedField",
                    "name": "runs",
                    "plural": true,
                    "selections": [
                      (v3/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "repetitionNumber",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "latencyMs",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "output",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "error",
                        "storageKey": null
                      },
                      (v5/*:: as any*/),
                      (v4/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "ExperimentRunAnnotationConnection",
                        "kind": "LinkedField",
                        "name": "annotations",
                        "plural": false,
                        "selections": [
                          {
                            "alias": null,
                            "args": null,
                            "concreteType": "ExperimentRunAnnotationEdge",
                            "kind": "LinkedField",
                            "name": "edges",
                            "plural": true,
                            "selections": [
                              {
                                "alias": "annotation",
                                "args": null,
                                "concreteType": "ExperimentRunAnnotation",
                                "kind": "LinkedField",
                                "name": "node",
                                "plural": false,
                                "selections": [
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
                                    "name": "score",
                                    "storageKey": null
                                  },
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
                                    "name": "annotatorKind",
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "explanation",
                                    "storageKey": null
                                  },
                                  {
                                    "alias": null,
                                    "args": null,
                                    "kind": "ScalarField",
                                    "name": "metadata",
                                    "storageKey": null
                                  },
                                  (v5/*:: as any*/)
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
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "DatasetExample",
            "abstractKey": null
          },
          (v3/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "269c7a61bf5175dbf2873128186319a2",
    "id": null,
    "metadata": {},
    "name": "useExperimentCompareLaneRunGroupQuery",
    "operationKind": "query",
    "text": "query useExperimentCompareLaneRunGroupQuery(\n  $exampleId: ID!\n  $experimentIds: [ID!]!\n) {\n  example: node(id: $exampleId) {\n    __typename\n    ... on DatasetExample {\n      experimentRepeatedRunGroups(experimentIds: $experimentIds) {\n        ...useExperimentCompareLaneRunGroup_runGroup\n        id\n      }\n    }\n    id\n  }\n}\n\nfragment useExperimentCompareLaneRunGroup_runGroup on ExperimentRepeatedRunGroup {\n  id\n  averageLatencyMs\n  costSummary {\n    total {\n      tokens\n      cost\n    }\n  }\n  runs {\n    id\n    repetitionNumber\n    latencyMs\n    output\n    error\n    trace {\n      traceId\n      projectId\n      id\n    }\n    costSummary {\n      total {\n        tokens\n        cost\n      }\n    }\n    annotations {\n      edges {\n        annotation: node {\n          id\n          name\n          score\n          label\n          annotatorKind\n          explanation\n          metadata\n          trace {\n            traceId\n            projectId\n            id\n          }\n        }\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "cd60a94d7a7af8e60cd349fb4b0716e5";

export default node;
