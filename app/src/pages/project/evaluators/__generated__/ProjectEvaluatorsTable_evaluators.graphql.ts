/**
 * @generated SignedSource<<34190d007a274593c75fcf4fefdafb8b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectEvaluatorsTable_evaluators$data = {
  readonly evaluators: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorsTable_row">;
      };
    }>;
  };
  readonly id: string;
  readonly " $fragmentType": "ProjectEvaluatorsTable_evaluators";
};
export type ProjectEvaluatorsTable_evaluators$key = {
  readonly " $data"?: ProjectEvaluatorsTable_evaluators$data;
  readonly " $fragmentSpreads": FragmentRefs<"ProjectEvaluatorsTable_evaluators">;
};

import ProjectEvaluatorsTableEvaluatorsQuery_graphql from './ProjectEvaluatorsTableEvaluatorsQuery.graphql';

const node: ReaderFragment = (function(){
var v0 = [
  "evaluators"
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
};
return {
  "argumentDefinitions": [
    {
      "defaultValue": null,
      "kind": "LocalArgument",
      "name": "after"
    },
    {
      "defaultValue": 100,
      "kind": "LocalArgument",
      "name": "first"
    }
  ],
  "kind": "Fragment",
  "metadata": {
    "connection": [
      {
        "count": "first",
        "cursor": "after",
        "direction": "forward",
        "path": (v0/*: any*/)
      }
    ],
    "refetch": {
      "connection": {
        "forward": {
          "count": "first",
          "cursor": "after"
        },
        "backward": null,
        "path": (v0/*: any*/)
      },
      "fragmentPathInResult": [
        "node"
      ],
      "operation": ProjectEvaluatorsTableEvaluatorsQuery_graphql,
      "identifierInfo": {
        "identifierField": "id",
        "identifierQueryVariableName": "id"
      }
    }
  },
  "name": "ProjectEvaluatorsTable_evaluators",
  "selections": [
    {
      "alias": "evaluators",
      "args": null,
      "concreteType": "ProjectEvaluatorConnection",
      "kind": "LinkedField",
      "name": "__ProjectEvaluatorsTable_evaluators_connection",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "ProjectEvaluatorEdge",
          "kind": "LinkedField",
          "name": "edges",
          "plural": true,
          "selections": [
            {
              "alias": null,
              "args": null,
              "concreteType": "ProjectEvaluator",
              "kind": "LinkedField",
              "name": "node",
              "plural": false,
              "selections": [
                {
                  "kind": "InlineDataFragmentSpread",
                  "name": "ProjectEvaluatorsTable_row",
                  "selections": [
                    (v1/*: any*/),
                    (v2/*: any*/),
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "evaluationTarget",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "samplingRate",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "filterCondition",
                      "storageKey": null
                    },
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "updatedAt",
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
                        (v1/*: any*/),
                        {
                          "alias": null,
                          "args": null,
                          "kind": "ScalarField",
                          "name": "kind",
                          "storageKey": null
                        },
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
                                (v1/*: any*/),
                                (v2/*: any*/)
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
                                (v2/*: any*/)
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
    },
    (v1/*: any*/)
  ],
  "type": "Project",
  "abstractKey": null
};
})();

(node as any).hash = "a211b772ffe2b7a672d3eede4dc2d3db";

export default node;
