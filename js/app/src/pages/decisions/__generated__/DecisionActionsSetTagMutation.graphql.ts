/**
 * @generated SignedSource<<54d53e02396b2508c05f269a8562b398>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DecisionActionsSetTagMutation$variables = {
  name: string;
  versionId: string;
};
export type DecisionActionsSetTagMutation$data = {
  readonly setDecisionVersionTag: {
    readonly decisionVersionTag: {
      readonly decisionVersionId: string;
      readonly id: string;
      readonly name: string;
    } | null;
  };
};
export type DecisionActionsSetTagMutation = {
  response: DecisionActionsSetTagMutation$data;
  variables: DecisionActionsSetTagMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "name"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "versionId"
},
v2 = [
  {
    "alias": null,
    "args": [
      {
        "fields": [
          {
            "kind": "Variable",
            "name": "decisionVersionId",
            "variableName": "versionId"
          },
          {
            "kind": "Variable",
            "name": "name",
            "variableName": "name"
          }
        ],
        "kind": "ObjectValue",
        "name": "input"
      }
    ],
    "concreteType": "DecisionVersionTagMutationPayload",
    "kind": "LinkedField",
    "name": "setDecisionVersionTag",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "DecisionVersionTag",
        "kind": "LinkedField",
        "name": "decisionVersionTag",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          },
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
            "name": "decisionVersionId",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "DecisionActionsSetTagMutation",
    "selections": (v2/*:: as any*/),
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
    "name": "DecisionActionsSetTagMutation",
    "selections": (v2/*:: as any*/)
  },
  "params": {
    "cacheID": "1c2f555c658c465b7b5c92303e087416",
    "id": null,
    "metadata": {},
    "name": "DecisionActionsSetTagMutation",
    "operationKind": "mutation",
    "text": "mutation DecisionActionsSetTagMutation(\n  $versionId: ID!\n  $name: Identifier!\n) {\n  setDecisionVersionTag(input: {decisionVersionId: $versionId, name: $name}) {\n    decisionVersionTag {\n      id\n      name\n      decisionVersionId\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "b6781b67e308a95d461f9fde537b33c2";

export default node;
