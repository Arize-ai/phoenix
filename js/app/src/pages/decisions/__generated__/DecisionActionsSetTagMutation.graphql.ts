/**
 * @generated SignedSource<<9a7be4f981d6153685132588e8c7b4ba>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DecisionActionsSetTagMutation$variables = {
  description?: string | null;
  name: string;
  versionId: string;
};
export type DecisionActionsSetTagMutation$data = {
  readonly setDecisionVersionTag: {
    readonly decisionVersionTag: {
      readonly decisionVersionId: string;
      readonly description: string | null;
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
  "name": "description"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "name"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "versionId"
},
v3 = [
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
            "name": "description",
            "variableName": "description"
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
            "name": "description",
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
      (v1/*:: as any*/),
      (v2/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "DecisionActionsSetTagMutation",
    "selections": (v3/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v2/*:: as any*/),
      (v1/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "DecisionActionsSetTagMutation",
    "selections": (v3/*:: as any*/)
  },
  "params": {
    "cacheID": "2caeaecccdecd9e28e9ff2aa38c657ba",
    "id": null,
    "metadata": {},
    "name": "DecisionActionsSetTagMutation",
    "operationKind": "mutation",
    "text": "mutation DecisionActionsSetTagMutation(\n  $versionId: ID!\n  $name: Identifier!\n  $description: String\n) {\n  setDecisionVersionTag(input: {decisionVersionId: $versionId, name: $name, description: $description}) {\n    decisionVersionTag {\n      id\n      name\n      description\n      decisionVersionId\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "2c7d10aff51b668b7d14c4be8977229a";

export default node;
