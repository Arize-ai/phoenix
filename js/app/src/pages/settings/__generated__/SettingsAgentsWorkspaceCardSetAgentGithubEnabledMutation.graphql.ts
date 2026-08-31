/**
 * @generated SignedSource<<86b1e21267ee0057706f58d3af696a4c>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SetAgentGithubEnabledInput = {
  enabled: boolean;
};
export type SettingsAgentsWorkspaceCardSetAgentGithubEnabledMutation$variables = {
  input: SetAgentGithubEnabledInput;
};
export type SettingsAgentsWorkspaceCardSetAgentGithubEnabledMutation$data = {
  readonly setAgentGithubEnabled: {
    readonly enabled: boolean;
  };
};
export type SettingsAgentsWorkspaceCardSetAgentGithubEnabledMutation = {
  response: SettingsAgentsWorkspaceCardSetAgentGithubEnabledMutation$data;
  variables: SettingsAgentsWorkspaceCardSetAgentGithubEnabledMutation$variables;
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
    "name": "SettingsAgentsWorkspaceCardSetAgentGithubEnabledMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "SettingsAgentsWorkspaceCardSetAgentGithubEnabledMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "132def14fca1ba7f3d5d6818dcc05003",
    "id": null,
    "metadata": {},
    "name": "SettingsAgentsWorkspaceCardSetAgentGithubEnabledMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsAgentsWorkspaceCardSetAgentGithubEnabledMutation(\n  $input: SetAgentGithubEnabledInput!\n) {\n  setAgentGithubEnabled(input: $input) {\n    enabled\n  }\n}\n"
  }
};
})();

(node as any).hash = "e48791a3e4357f0d2e4704ffdc04016c";

export default node;
