/**
 * @generated SignedSource<<dffbe298e65b8b4426f88375c17e5e42>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SetAgentAssistantEnabledInput = {
  enabled: boolean;
};
export type SettingsAgentsWorkspaceCardSetAgentAssistantEnabledMutation$variables = {
  input: SetAgentAssistantEnabledInput;
};
export type SettingsAgentsWorkspaceCardSetAgentAssistantEnabledMutation$data = {
  readonly setAgentAssistantEnabled: {
    readonly enabled: boolean;
  };
};
export type SettingsAgentsWorkspaceCardSetAgentAssistantEnabledMutation = {
  response: SettingsAgentsWorkspaceCardSetAgentAssistantEnabledMutation$data;
  variables: SettingsAgentsWorkspaceCardSetAgentAssistantEnabledMutation$variables;
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
    "name": "SettingsAgentsWorkspaceCardSetAgentAssistantEnabledMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "SettingsAgentsWorkspaceCardSetAgentAssistantEnabledMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "ec85b24f77e8ee6a2ccda1ed49454972",
    "id": null,
    "metadata": {},
    "name": "SettingsAgentsWorkspaceCardSetAgentAssistantEnabledMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsAgentsWorkspaceCardSetAgentAssistantEnabledMutation(\n  $input: SetAgentAssistantEnabledInput!\n) {\n  setAgentAssistantEnabled(input: $input) {\n    enabled\n  }\n}\n"
  }
};
})();

(node as any).hash = "f30d583cd02b8e97af398d3dc3e6e88b";

export default node;
