/**
 * @generated SignedSource<<cfa48b83b4670e0e4f8d2a38bd4c6647>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DecisionLabelConfigButtonUnsetLabelsMutation$variables = {
  decisionId: string;
  decisionLabelIds: ReadonlyArray<string>;
};
export type DecisionLabelConfigButtonUnsetLabelsMutation$data = {
  readonly unsetDecisionLabels: {
    readonly query: {
      readonly node: {
        readonly " $fragmentSpreads": FragmentRefs<"DecisionLabelConfigButton_decisionLabels">;
      };
    };
  };
};
export type DecisionLabelConfigButtonUnsetLabelsMutation = {
  response: DecisionLabelConfigButtonUnsetLabelsMutation$data;
  variables: DecisionLabelConfigButtonUnsetLabelsMutation$variables;
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
    "name": "DecisionLabelConfigButtonUnsetLabelsMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "DecisionLabelAssociationMutationPayload",
        "kind": "LinkedField",
        "name": "unsetDecisionLabels",
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
    "name": "DecisionLabelConfigButtonUnsetLabelsMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "DecisionLabelAssociationMutationPayload",
        "kind": "LinkedField",
        "name": "unsetDecisionLabels",
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
    "cacheID": "ec150038a83d541f4ce7fa939865cee3",
    "id": null,
    "metadata": {},
    "name": "DecisionLabelConfigButtonUnsetLabelsMutation",
    "operationKind": "mutation",
    "text": "mutation DecisionLabelConfigButtonUnsetLabelsMutation(\n  $decisionId: ID!\n  $decisionLabelIds: [ID!]!\n) {\n  unsetDecisionLabels(input: {decisionId: $decisionId, decisionLabelIds: $decisionLabelIds}) {\n    query {\n      node(id: $decisionId) {\n        __typename\n        ... on Decision {\n          ...DecisionLabelConfigButton_decisionLabels\n        }\n        id\n      }\n    }\n  }\n}\n\nfragment DecisionLabelConfigButton_decisionLabels on Decision {\n  id\n  labels {\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "b2979c64117b4722c509ca0c69ab3997";

export default node;
