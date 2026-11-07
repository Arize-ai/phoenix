/**
 * @generated SignedSource<<cf76af7775f91bd40d96e35e466915d6>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DecisionLabelConfigButtonSetLabelsMutation$variables = {
  decisionId: string;
  decisionLabelIds: ReadonlyArray<string>;
};
export type DecisionLabelConfigButtonSetLabelsMutation$data = {
  readonly setDecisionLabels: {
    readonly query: {
      readonly node: {
        readonly " $fragmentSpreads": FragmentRefs<"DecisionLabelConfigButton_decisionLabels">;
      };
    };
  };
};
export type DecisionLabelConfigButtonSetLabelsMutation = {
  response: DecisionLabelConfigButtonSetLabelsMutation$data;
  variables: DecisionLabelConfigButtonSetLabelsMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "decisionId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "decisionLabelIds"
  }
],
v1 = [
  {
    "fields": [
      {
        "kind": "Variable",
        "name": "decisionId",
        "variableName": "decisionId"
      },
      {
        "kind": "Variable",
        "name": "decisionLabelIds",
        "variableName": "decisionLabelIds"
      }
    ],
    "kind": "ObjectValue",
    "name": "input"
  }
],
v2 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "decisionId"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DecisionLabelConfigButtonSetLabelsMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "DecisionLabelAssociationMutationPayload",
        "kind": "LinkedField",
        "name": "setDecisionLabels",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "alias": null,
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
                        "args": null,
                        "kind": "FragmentSpread",
                        "name": "DecisionLabelConfigButton_decisionLabels"
                      }
                    ],
                    "type": "Decision",
                    "abstractKey": null
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
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "DecisionLabelConfigButtonSetLabelsMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "DecisionLabelAssociationMutationPayload",
        "kind": "LinkedField",
        "name": "setDecisionLabels",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "alias": null,
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
                  (v3/*:: as any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "DecisionLabel",
                        "kind": "LinkedField",
                        "name": "labels",
                        "plural": true,
                        "selections": [
                          (v3/*:: as any*/)
                        ],
                        "storageKey": null
                      }
                    ],
                    "type": "Decision",
                    "abstractKey": null
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
    ]
  },
  "params": {
    "cacheID": "4dd6c98a97a7457c530fa3bda95e9af7",
    "id": null,
    "metadata": {},
    "name": "DecisionLabelConfigButtonSetLabelsMutation",
    "operationKind": "mutation",
    "text": "mutation DecisionLabelConfigButtonSetLabelsMutation(\n  $decisionId: ID!\n  $decisionLabelIds: [ID!]!\n) {\n  setDecisionLabels(input: {decisionId: $decisionId, decisionLabelIds: $decisionLabelIds}) {\n    query {\n      node(id: $decisionId) {\n        __typename\n        ... on Decision {\n          ...DecisionLabelConfigButton_decisionLabels\n        }\n        id\n      }\n    }\n  }\n}\n\nfragment DecisionLabelConfigButton_decisionLabels on Decision {\n  id\n  labels {\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "5f31f277f4bb9b161f15d2359117a9ba";

export default node;
