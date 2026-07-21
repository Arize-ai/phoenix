/**
 * @generated SignedSource<<e65357e2df2da72b7220645507bd1904>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SetAgentSessionRetentionInput = {
  maxCountPerUser: number;
  maxIdleDays: number;
};
export type SettingsAgentsWorkspaceCardSetSessionRetentionMutation$variables = {
  input: SetAgentSessionRetentionInput;
};
export type SettingsAgentsWorkspaceCardSetSessionRetentionMutation$data = {
  readonly setAgentSessionRetention: {
    readonly maxCountPerUser: number;
    readonly maxIdleDays: number;
  };
};
export type SettingsAgentsWorkspaceCardSetSessionRetentionMutation = {
  response: SettingsAgentsWorkspaceCardSetSessionRetentionMutation$data;
  variables: SettingsAgentsWorkspaceCardSetSessionRetentionMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": "AgentSessionRetention",
    "kind": "LinkedField",
    "name": "setAgentSessionRetention",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "maxIdleDays",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "maxCountPerUser",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SettingsAgentsWorkspaceCardSetSessionRetentionMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "SettingsAgentsWorkspaceCardSetSessionRetentionMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "a3349aad1891086fe1e211dbb4a465fc",
    "id": null,
    "metadata": {},
    "name": "SettingsAgentsWorkspaceCardSetSessionRetentionMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsAgentsWorkspaceCardSetSessionRetentionMutation(\n  $input: SetAgentSessionRetentionInput!\n) {\n  setAgentSessionRetention(input: $input) {\n    maxIdleDays\n    maxCountPerUser\n  }\n}\n"
  }
};
})();

(node as any).hash = "e72a772c327f57ab687d91d9ff63037f";

export default node;
