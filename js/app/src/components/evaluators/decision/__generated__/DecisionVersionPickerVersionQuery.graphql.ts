/**
 * @generated SignedSource<<e8f3419d10edab48d87e611c068cda4e>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DecisionVersionPickerVersionQuery$variables = {
  decisionId: string;
  tagName?: string | null;
  versionId?: string | null;
};
export type DecisionVersionPickerVersionQuery$data = {
  readonly decision: {
    readonly id?: string;
    readonly name?: string;
    readonly version?: {
      readonly id: string;
      readonly inputs: ReadonlyArray<{
        readonly description: string | null;
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
export type DecisionVersionPickerVersionQuery = {
  response: DecisionVersionPickerVersionQuery$data;
  variables: DecisionVersionPickerVersionQuery$variables;
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
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v7 = {
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
      "selections": [
        (v5/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "description",
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
      "name": "questions",
      "plural": true,
      "selections": [
        (v6/*:: as any*/),
        {
          "kind": "InlineFragment",
          "selections": [
            (v5/*:: as any*/)
          ],
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
    "name": "DecisionVersionPickerVersionQuery",
    "selections": [
      {
        "alias": "decision",
        "args": (v3/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*:: as any*/),
              (v5/*:: as any*/),
              (v7/*:: as any*/)
            ],
            "type": "Decision",
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
      (v0/*:: as any*/),
      (v2/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "DecisionVersionPickerVersionQuery",
    "selections": [
      {
        "alias": "decision",
        "args": (v3/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v6/*:: as any*/),
          (v4/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v5/*:: as any*/),
              (v7/*:: as any*/)
            ],
            "type": "Decision",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "8bb78b0196e8ac2775aed679ce724fe0",
    "id": null,
    "metadata": {},
    "name": "DecisionVersionPickerVersionQuery",
    "operationKind": "query",
    "text": "query DecisionVersionPickerVersionQuery(\n  $decisionId: ID!\n  $versionId: ID\n  $tagName: Identifier\n) {\n  decision: node(id: $decisionId) {\n    __typename\n    ... on Decision {\n      id\n      name\n      version(versionId: $versionId, tagName: $tagName) {\n        id\n        sequenceNumber\n        inputs {\n          name\n          description\n        }\n        questions {\n          __typename\n          ... on DecisionPredicateQuestion {\n            name\n          }\n          ... on DecisionChoiceQuestion {\n            name\n            choices {\n              value\n            }\n          }\n          ... on DecisionScaleQuestion {\n            name\n            levels {\n              label\n            }\n          }\n        }\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "f55c0d33bf078544e1ddefd968b63c77";

export default node;
