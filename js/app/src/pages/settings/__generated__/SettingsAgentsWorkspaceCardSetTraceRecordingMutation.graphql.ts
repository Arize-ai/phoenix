/**
 * @generated SignedSource<<a27f38ae0a9cdb46877c288e63acf314>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SetAgentTraceRecordingInput = {
  allowLocalTraces: boolean;
  allowRemoteExport: boolean;
};
export type SettingsAgentsWorkspaceCardSetTraceRecordingMutation$variables = {
  input: SetAgentTraceRecordingInput;
};
export type SettingsAgentsWorkspaceCardSetTraceRecordingMutation$data = {
  readonly setAgentTraceRecording: {
    readonly allowLocalTraces: boolean;
    readonly allowRemoteExport: boolean;
  };
};
export type SettingsAgentsWorkspaceCardSetTraceRecordingMutation = {
  response: SettingsAgentsWorkspaceCardSetTraceRecordingMutation$data;
  variables: SettingsAgentsWorkspaceCardSetTraceRecordingMutation$variables;
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
    "concreteType": "AgentTraceRecording",
    "kind": "LinkedField",
    "name": "setAgentTraceRecording",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "allowLocalTraces",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "allowRemoteExport",
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
    "name": "SettingsAgentsWorkspaceCardSetTraceRecordingMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "SettingsAgentsWorkspaceCardSetTraceRecordingMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "12d8e45409795fa51183e2733cb0cb94",
    "id": null,
    "metadata": {},
    "name": "SettingsAgentsWorkspaceCardSetTraceRecordingMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsAgentsWorkspaceCardSetTraceRecordingMutation(\n  $input: SetAgentTraceRecordingInput!\n) {\n  setAgentTraceRecording(input: $input) {\n    allowLocalTraces\n    allowRemoteExport\n  }\n}\n"
  }
};
})();

(node as any).hash = "a3d1ce0f69b4d309a16e1d06100506dc";

export default node;
