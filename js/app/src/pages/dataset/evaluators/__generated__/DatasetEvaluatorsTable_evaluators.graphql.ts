/**
 * @generated SignedSource<<c5524b5d4ad365bff7819dceacad05fe>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DatasetEvaluatorsTable_evaluators$data = {
  readonly datasetEvaluators: {
    readonly __id: string;
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly " $fragmentSpreads": FragmentRefs<"DatasetEvaluatorsTable_row">;
      };
    }>;
  };
  readonly id: string;
  readonly " $fragmentType": "DatasetEvaluatorsTable_evaluators";
};
export type DatasetEvaluatorsTable_evaluators$key = {
  readonly " $data"?: DatasetEvaluatorsTable_evaluators$data;
  readonly " $fragmentSpreads": FragmentRefs<"DatasetEvaluatorsTable_evaluators">;
};

import DatasetEvaluatorsTableEvaluatorsQuery_graphql from './DatasetEvaluatorsTableEvaluatorsQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "costTimeRange"
},
v1 = [
  "datasetEvaluators"
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
},
v5 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "cost",
    "storageKey": null
  }
];
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "after"
    },
    (v0/*:: as any*/),
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "filter"
    },
    {
      "defaultValue": 100,
      "kind": "LocalArgument",
      "name": "first"
    },
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "sort"
    }
  ],
  "kind": "Fragment",
  "metadata": {
    "connection": [
      {
        "count": "first",
        "cursor": "after",
        "direction": "forward",
        "path": (v1/*:: as any*/)
      }
    ],
    "refetch": {
      "connection": {
        "forward": {
          "count": "first",
          "cursor": "after"
        },
        "backward": null,
        "path": (v1/*:: as any*/)
      },
      "fragmentPathInResult": [
        "node"
      ],
      "operation": DatasetEvaluatorsTableEvaluatorsQuery_graphql,
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
    }
  },
  "name": "DatasetEvaluatorsTable_evaluators",
  "selections": [
    {
      "alias": "datasetEvaluators",
      "args": [
        {
          "kind": "Variable",
          "name": "filter",
          "variableName": "filter"
        },
        {
          "kind": "Variable",
          "name": "sort",
          "variableName": "sort"
        }
      ],
      "concreteType": "DatasetEvaluatorConnection",
      "kind": "LinkedField",
      "name": "__DatasetEvaluatorsTable_datasetEvaluators_connection",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "DatasetEvaluatorEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "DatasetEvaluator",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                {
                  "kind": "InlineDataFragmentSpread",
                  "name": "DatasetEvaluatorsTable_row",
                  "selections": [
                    (v2/*:: as any*/),
                    (v3/*:: as any*/),
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "description",
                      "storageKey": null
                    },
                    (v4/*:: as any*/),
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "User",
                      "kind": "LinkedField",
                      "name": "user",
                      "plural": false,
                      "selections": [
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "username",
                          "storageKey": null
                        },
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "profilePictureUrl",
                          "storageKey": null
                        }
                      ],
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "concreteType": "Project",
                      "kind": "LinkedField",
                      "name": "project",
                      "plural": false,
                      "selections": [
                        (v2/*:: as any*/),
                        {
                          "alias": null,
                          "args": [
                            {
                              "kind": "Variable",
                              "name": "timeRange",
                              "variableName": "costTimeRange"
                            }
                          ],
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
                              "selections": (v5/*:: as any*/),
                              "storageKey": null
                            },
                            {
                              "alias": null,
                              "args": null,
                              "concreteType": "CostBreakdown",
                              "kind": "LinkedField",
                              "name": "prompt",
                              "plural": false,
                              "selections": (v5/*:: as any*/),
                              "storageKey": null
                            },
                            {
                              "alias": null,
                              "args": null,
                              "concreteType": "CostBreakdown",
                              "kind": "LinkedField",
                              "name": "completion",
                              "plural": false,
                              "selections": (v5/*:: as any*/),
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
                      "concreteType": null,
                      "kind": "LinkedField",
                      "name": "evaluator",
                      "plural": false,
                      "selections": [
                        (v2/*:: as any*/),
                        (v3/*:: as any*/),
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "kind",
                          "storageKey": null
                        },
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "createdAt",
                          "storageKey": null
                        },
                        (v4/*:: as any*/),
                        {
                          "kind": "InlineFragment",
                          "selections": [
                            {
                              "alias": null,
                              "args": null,
                              "concreteType": "Prompt",
                              "kind": "LinkedField",
                              "name": "prompt",
                              "plural": false,
                              "selections": [
                                (v2/*:: as any*/),
                                (v3/*:: as any*/)
                              ],
                              "storageKey": null
                            },
                            {
                              "alias": null,
                              "args": null,
                              "concreteType": "PromptVersionTag",
                              "kind": "LinkedField",
                              "name": "promptVersionTag",
                              "plural": false,
                              "selections": [
                                (v3/*:: as any*/)
                              ],
                              "storageKey": null
                            },
                            {
                              "alias": null,
                              "args": null,
                              "concreteType": "PromptVersion",
                              "kind": "LinkedField",
                              "name": "promptVersion",
                              "plural": false,
                              "selections": [
                                {
                                  "alias": null,
                                  "args": null,
                                  "kind": "ScalarField",
                                  "name": "modelName",
                                  "storageKey": null
                                },
                                {
                                  "alias": null,
                                  "args": null,
                                  "kind": "ScalarField",
                                  "name": "modelProvider",
                                  "storageKey": null
                                }
                              ],
                              "storageKey": null
                            }
                          ],
                          "type": "LLMEvaluator",
                          "abstractKey": null
                        },
                        {
                          "kind": "InlineFragment",
                          "selections": [
                            {
                              "alias": null,
                              "args": null,
                              "kind": "ScalarField",
                              "name": "language",
                              "storageKey": null
                            },
                            {
                              "alias": null,
                              "args": null,
                              "concreteType": "SandboxConfig",
                              "kind": "LinkedField",
                              "name": "sandboxConfig",
                              "plural": false,
                              "selections": [
                                (v2/*:: as any*/),
                                (v3/*:: as any*/),
                                {
                                  "alias": null,
                                  "args": null,
                                  "concreteType": "SandboxProvider",
                                  "kind": "LinkedField",
                                  "name": "provider",
                                  "plural": false,
                                  "selections": [
                                    {
                                      "alias": null,
                                      "args": null,
                                      "kind": "ScalarField",
                                      "name": "backendType",
                                      "storageKey": null
                                    }
                                  ],
                                  "storageKey": null
                                }
                              ],
                              "storageKey": null
                            }
                          ],
                          "type": "CodeEvaluator",
                          "abstractKey": null
                        }
                      ],
                      "storageKey": null
                    }
                  ],
                  "args": [
                    {
                      "kind": "Variable",
                      "name": "costTimeRange",
                      "variableName": "costTimeRange"
                    }
                  ],
                  "argumentDefinitions": [
                    (v0/*:: as any*/)
                  ]
                },
                {
                  "alias": null,
                  "args": null,
                  "kind": "ScalarField",
                  "name": "__typename",
                  "storageKey": null
                }
              ],
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "cursor",
              "storageKey": null
            }
          ],
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": "PageInfo",
          "kind": "LinkedField",
          "name": "pageInfo",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "endCursor",
              "storageKey": null
            },
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "hasNextPage",
              "storageKey": null
            }
          ],
          "storageKey": null
        },
        {
          "kind": "ClientExtension",
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "__id",
              "storageKey": null
            }
          ]
        }
      ],
      "storageKey": null
    },
    (v2/*:: as any*/)
  ],
  "type": "Dataset",
  "abstractKey": null
};
})();

(node as any).hash = "cc84d1b492249e49c001aa1619fda62f";

export default node;
