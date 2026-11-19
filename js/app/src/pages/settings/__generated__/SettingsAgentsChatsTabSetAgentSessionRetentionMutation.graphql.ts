/**
 * @generated SignedSource<<106ff00de286340fc37ec970947cfc5a>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SetAgentSessionRetentionInput = {
  maxCountPerUser?: number | null;
  maxIdleDays?: number | null;
};
export type SettingsAgentsChatsTabSetAgentSessionRetentionMutation$variables = {
  input: SetAgentSessionRetentionInput;
};
export type SettingsAgentsChatsTabSetAgentSessionRetentionMutation$data = {
  readonly setAgentSessionRetention: {
    readonly maxCountPerUser: number | null;
    readonly maxIdleDays: number | null;
  };
};
export type SettingsAgentsChatsTabSetAgentSessionRetentionMutation = {
  response: SettingsAgentsChatsTabSetAgentSessionRetentionMutation$data;
  variables: SettingsAgentsChatsTabSetAgentSessionRetentionMutation$variables;
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
    "name": "SettingsAgentsChatsTabSetAgentSessionRetentionMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "SettingsAgentsChatsTabSetAgentSessionRetentionMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "0fb6c6116286381d3d40dea577f2853e",
    "id": null,
    "metadata": {},
    "name": "SettingsAgentsChatsTabSetAgentSessionRetentionMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsAgentsChatsTabSetAgentSessionRetentionMutation(\n  $input: SetAgentSessionRetentionInput!\n) {\n  setAgentSessionRetention(input: $input) {\n    maxIdleDays\n    maxCountPerUser\n  }\n}\n"
  }
};
})();

(node as any).hash = "0b5e0100fb79968cb20885ea012e8db5";

export default node;
