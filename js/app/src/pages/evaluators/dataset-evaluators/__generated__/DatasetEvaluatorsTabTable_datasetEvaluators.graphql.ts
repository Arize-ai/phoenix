/**
 * @generated SignedSource<<d509000811d9477135a1c0383465d0d6>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DatasetEvaluatorsTabTable_datasetEvaluators$data = {
  readonly datasetEvaluators: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly " $fragmentSpreads": FragmentRefs<"DatasetEvaluatorsTable_row">;
      };
    }>;
  };
  readonly " $fragmentType": "DatasetEvaluatorsTabTable_datasetEvaluators";
};
export type DatasetEvaluatorsTabTable_datasetEvaluators$key = {
  readonly " $data"?: DatasetEvaluatorsTabTable_datasetEvaluators$data;
  readonly " $fragmentSpreads": FragmentRefs<"DatasetEvaluatorsTabTable_datasetEvaluators">;
};

import DatasetEvaluatorsTabTableQuery_graphql from './DatasetEvaluatorsTabTableQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = [
  "datasetEvaluators"
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "updatedAt",
  "storageKey": null
},
v4 = [
  (v1/*:: as any*/),
  (v2/*:: as any*/)
],
v5 = [
  (v2/*:: as any*/)
],
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelName",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelProvider",
  "storageKey": null
};
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "after"
    },
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
        "path": (v0/*:: as any*/)
      }
    ],
    "refetch": {
      "connection": {
        "forward": {
          "count": "first",
          "cursor": "after"
        },
        "backward": null,
        "path": (v0/*:: as any*/)
      },
      "fragmentPathInResult": [],
      "operation": DatasetEvaluatorsTabTableQuery_graphql
    }
  },
  "name": "DatasetEvaluatorsTabTable_datasetEvaluators",
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
      "name": "__DatasetEvaluatorsTabTable_datasetEvaluators_connection",
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
                    (v1/*:: as any*/),
                    (v2/*:: as any*/),
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "description",
                      "storageKey": null
                    },
                    (v3/*:: as any*/),
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
                      "concreteType": "Dataset",
                      "kind": "LinkedField",
                      "name": "dataset",
                      "plural": false,
                      "selections": (v4/*:: as any*/),
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
                        (v1/*:: as any*/),
                        (v2/*:: as any*/),
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
                        (v3/*:: as any*/),
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
                              "selections": (v4/*:: as any*/),
                              "storageKey": null
                            },
                            {
                              "alias": null,
                              "args": null,
                              "concreteType": "PromptVersionTag",
                              "kind": "LinkedField",
                              "name": "promptVersionTag",
                              "plural": false,
                              "selections": (v5/*:: as any*/),
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
                                (v6/*:: as any*/),
                                (v7/*:: as any*/)
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
                              "concreteType": "DecisionVersion",
                              "kind": "LinkedField",
                              "name": "decisionVersion",
                              "plural": false,
                              "selections": [
                                (v1/*:: as any*/),
                                {
                                  "alias": null,
                                  "args": null,
                                  "kind": "ScalarField",
                                  "name": "decisionId",
                                  "storageKey": null
                                },
                                {
                                  "alias": null,
                                  "args": null,
                                  "concreteType": "Decision",
                                  "kind": "LinkedField",
                                  "name": "decision",
                                  "plural": false,
                                  "selections": (v5/*:: as any*/),
                                  "storageKey": null
                                },
                                (v6/*:: as any*/),
                                (v7/*:: as any*/)
                              ],
                              "storageKey": null
                            }
                          ],
                          "type": "DecisionEvaluator",
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
                                (v1/*:: as any*/),
                                (v2/*:: as any*/),
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
                  "args": null,
                  "argumentDefinitions": []
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
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Query",
  "abstractKey": null
};
})();

(node as any).hash = "d8a4a516e40f8786f49cf73cc8883633";

export default node;
