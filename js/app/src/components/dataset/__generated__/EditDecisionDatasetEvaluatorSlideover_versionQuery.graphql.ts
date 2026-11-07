/**
 * @generated SignedSource<<f82637d3c5d76e57acd4350ff347db78>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EditDecisionDatasetEvaluatorSlideover_versionQuery$variables = {
  decisionId: string;
  tagName?: string | null;
  versionId?: string | null;
};
export type EditDecisionDatasetEvaluatorSlideover_versionQuery$data = {
  readonly decision: {
    readonly version?: {
      readonly id: string;
      readonly inputs: ReadonlyArray<{
        readonly name: string;
      }>;
      readonly questions: ReadonlyArray<{
        readonly __typename: "DecisionChoiceQuestion";
        readonly choices: ReadonlyArray<{
          readonly value: string;
        }>;
        readonly name: string;
      } | {
        readonly __typename: "DecisionPredicateQuestion";
        readonly name: string;
      } | {
        readonly __typename: "DecisionScaleQuestion";
        readonly levels: ReadonlyArray<{
          readonly label: string;
        }>;
        readonly name: string;
      } | {
        // This will never be '%other', but we need some
        // value in case none of the concrete values match.
        readonly __typename: "%other";
      }>;
      readonly sequenceNumber: number;
    } | null;
  };
};
export type EditDecisionDatasetEvaluatorSlideover_versionQuery = {
  response: EditDecisionDatasetEvaluatorSlideover_versionQuery$data;
  variables: EditDecisionDatasetEvaluatorSlideover_versionQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "decisionId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "tagName"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "versionId"
},
v3 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "decisionId"
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
  (v5/*:: as any*/)
],
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v8 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": [
        {
          "kind": "Variable",
          "name": "tagName",
          "variableName": "tagName"
        },
        {
          "kind": "Variable",
          "name": "versionId",
          "variableName": "versionId"
        }
      ],
      "concreteType": "DecisionVersion",
      "kind": "LinkedField",
      "name": "version",
      "plural": false,
      "selections": [
        (v4/*:: as any*/),
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
          "concreteType": "DecisionInputDefinition",
          "kind": "LinkedField",
          "name": "inputs",
          "plural": true,
          "selections": (v6/*:: as any*/),
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "concreteType": null,
          "kind": "LinkedField",
          "name": "questions",
          "plural": true,
          "selections": [
            (v7/*:: as any*/),
            {
              "kind": "InlineFragment",
              "selections": (v6/*:: as any*/),
              "type": "DecisionPredicateQuestion",
              "abstractKey": null
            },
            {
              "kind": "InlineFragment",
              "selections": [
                (v5/*:: as any*/),
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "DecisionChoiceOption",
                  "kind": "LinkedField",
                  "name": "choices",
                  "plural": true,
                  "selections": [
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "value",
                      "storageKey": null
                    }
                  ],
                  "storageKey": null
                }
              ],
              "type": "DecisionChoiceQuestion",
              "abstractKey": null
            },
            {
              "kind": "InlineFragment",
              "selections": [
                (v5/*:: as any*/),
                {
                  "alias": null,
                  "args": null,
                  "concreteType": "DecisionScaleLevel",
                  "kind": "LinkedField",
                  "name": "levels",
                  "plural": true,
                  "selections": [
                    {
                      "alias": null,
                      "args": null,
                      "kind": "ScalarField",
                      "name": "label",
                      "storageKey": null
                    }
                  ],
                  "storageKey": null
                }
              ],
              "type": "DecisionScaleQuestion",
              "abstractKey": null
            }
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Decision",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "EditDecisionDatasetEvaluatorSlideover_versionQuery",
    "selections": [
      {
        "alias": "decision",
        "args": (v3/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v8/*:: as any*/)
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
      (v0/*:: as any*/),
      (v2/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "EditDecisionDatasetEvaluatorSlideover_versionQuery",
    "selections": [
      {
        "alias": "decision",
        "args": (v3/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v7/*:: as any*/),
          (v8/*:: as any*/),
          (v4/*:: as any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "b6d383ed05a3f386a1538df551bed9b9",
    "id": null,
    "metadata": {},
    "name": "EditDecisionDatasetEvaluatorSlideover_versionQuery",
    "operationKind": "query",
    "text": "query EditDecisionDatasetEvaluatorSlideover_versionQuery(\n  $decisionId: ID!\n  $versionId: ID\n  $tagName: Identifier\n) {\n  decision: node(id: $decisionId) {\n    __typename\n    ... on Decision {\n      version(versionId: $versionId, tagName: $tagName) {\n        id\n        sequenceNumber\n        inputs {\n          name\n        }\n        questions {\n          __typename\n          ... on DecisionPredicateQuestion {\n            name\n          }\n          ... on DecisionChoiceQuestion {\n            name\n            choices {\n              value\n            }\n          }\n          ... on DecisionScaleQuestion {\n            name\n            levels {\n              label\n            }\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "de5521be8beca72fde8dfb04a1509907";

export default node;
