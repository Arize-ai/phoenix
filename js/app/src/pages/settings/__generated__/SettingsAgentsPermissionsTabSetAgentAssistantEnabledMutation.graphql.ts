/**
 * @generated SignedSource<<70a80e404a4d41b90013dea70c3345fc>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SetAgentAssistantEnabledInput = {
  enabled: boolean;
};
export type SettingsAgentsPermissionsTabSetAgentAssistantEnabledMutation$variables = {
  input: SetAgentAssistantEnabledInput;
};
export type SettingsAgentsPermissionsTabSetAgentAssistantEnabledMutation$data = {
  readonly setAgentAssistantEnabled: {
    readonly enabled: boolean;
  };
};
export type SettingsAgentsPermissionsTabSetAgentAssistantEnabledMutation = {
  response: SettingsAgentsPermissionsTabSetAgentAssistantEnabledMutation$data;
  variables: SettingsAgentsPermissionsTabSetAgentAssistantEnabledMutation$variables;
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
    "concreteType": "AgentAssistantEnabled",
    "kind": "LinkedField",
    "name": "setAgentAssistantEnabled",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "enabled",
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
    "name": "SettingsAgentsPermissionsTabSetAgentAssistantEnabledMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "SettingsAgentsPermissionsTabSetAgentAssistantEnabledMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "979810c379ade6c5361f66eee0476689",
    "id": null,
    "metadata": {},
    "name": "SettingsAgentsPermissionsTabSetAgentAssistantEnabledMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsAgentsPermissionsTabSetAgentAssistantEnabledMutation(\n  $input: SetAgentAssistantEnabledInput!\n) {\n  setAgentAssistantEnabled(input: $input) {\n    enabled\n  }\n}\n"
  }
};
})();

(node as any).hash = "4a30bfbaf263f7e0fb5648957230902e";

export default node;
