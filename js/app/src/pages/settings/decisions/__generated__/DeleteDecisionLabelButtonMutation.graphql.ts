/**
 * @generated SignedSource<<7b594b02eceb7c7da84a1a4b47e254f1>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DeleteDecisionLabelsInput = {
  decisionLabelIds: ReadonlyArray<string>;
};
export type DeleteDecisionLabelButtonMutation$variables = {
  connections: ReadonlyArray<string>;
  input: DeleteDecisionLabelsInput;
};
export type DeleteDecisionLabelButtonMutation$data = {
  readonly deleteDecisionLabels: {
    readonly deletedDecisionLabelIds: ReadonlyArray<string>;
  };
};
export type DeleteDecisionLabelButtonMutation = {
  response: DeleteDecisionLabelButtonMutation$data;
  variables: DeleteDecisionLabelButtonMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "connections"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "input"
},
v2 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "deletedDecisionLabelIds",
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
    "name": "DeleteDecisionLabelButtonMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "DecisionLabelDeleteMutationPayload",
        "kind": "LinkedField",
        "name": "deleteDecisionLabels",
        "plural": false,
        "selections": [
          (v3/*:: as any*/)
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
    "name": "DeleteDecisionLabelButtonMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*:: as any*/),
        "concreteType": "DecisionLabelDeleteMutationPayload",
        "kind": "LinkedField",
        "name": "deleteDecisionLabels",
        "plural": false,
        "selections": [
          (v3/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "filters": null,
            "handle": "deleteEdge",
            "key": "",
            "kind": "ScalarHandle",
            "name": "deletedDecisionLabelIds",
            "handleArgs": [
              {
                "kind": "Variable",
                "name": "connections",
                "variableName": "connections"
              }
            ]
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "3423b3c96f9cc992275d93223be5d8a8",
    "id": null,
    "metadata": {},
    "name": "DeleteDecisionLabelButtonMutation",
    "operationKind": "mutation",
    "text": "mutation DeleteDecisionLabelButtonMutation(\n  $input: DeleteDecisionLabelsInput!\n) {\n  deleteDecisionLabels(input: $input) {\n    deletedDecisionLabelIds\n  }\n}\n"
  }
};
})();

(node as any).hash = "eb8f22e3156534debc75c75ba9ee1abb";

export default node;
