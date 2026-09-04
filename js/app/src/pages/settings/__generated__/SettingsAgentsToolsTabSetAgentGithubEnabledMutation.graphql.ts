/**
 * @generated SignedSource<<cc4ceb8c8088ee1f57dcc1aeae86e828>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SetAgentGithubEnabledInput = {
  enabled: boolean;
};
export type SettingsAgentsToolsTabSetAgentGithubEnabledMutation$variables = {
  input: SetAgentGithubEnabledInput;
};
export type SettingsAgentsToolsTabSetAgentGithubEnabledMutation$data = {
  readonly setAgentGithubEnabled: {
    readonly enabled: boolean;
  };
};
export type SettingsAgentsToolsTabSetAgentGithubEnabledMutation = {
  response: SettingsAgentsToolsTabSetAgentGithubEnabledMutation$data;
  variables: SettingsAgentsToolsTabSetAgentGithubEnabledMutation$variables;
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
    "concreteType": "AgentGithubEnabled",
    "kind": "LinkedField",
    "name": "setAgentGithubEnabled",
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
    "name": "SettingsAgentsToolsTabSetAgentGithubEnabledMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "SettingsAgentsToolsTabSetAgentGithubEnabledMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "bcef3b8829da585cd1ddb249656fefdd",
    "id": null,
    "metadata": {},
    "name": "SettingsAgentsToolsTabSetAgentGithubEnabledMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsAgentsToolsTabSetAgentGithubEnabledMutation(\n  $input: SetAgentGithubEnabledInput!\n) {\n  setAgentGithubEnabled(input: $input) {\n    enabled\n  }\n}\n"
  }
};
})();

(node as any).hash = "cca021274810e27ba6fe72ebc7057b51";

export default node;
