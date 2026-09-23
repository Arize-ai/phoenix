/**
 * @generated SignedSource<<2ce140e0f9a67b7015c446bf280d501f>>
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
export type SettingsAgentsTracingTabSetAgentTraceRecordingMutation$variables = {
  input: SetAgentTraceRecordingInput;
};
export type SettingsAgentsTracingTabSetAgentTraceRecordingMutation$data = {
  readonly setAgentTraceRecording: {
    readonly allowLocalTraces: boolean;
    readonly allowRemoteExport: boolean;
  };
};
export type SettingsAgentsTracingTabSetAgentTraceRecordingMutation = {
  response: SettingsAgentsTracingTabSetAgentTraceRecordingMutation$data;
  variables: SettingsAgentsTracingTabSetAgentTraceRecordingMutation$variables;
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
    "name": "SettingsAgentsTracingTabSetAgentTraceRecordingMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "SettingsAgentsTracingTabSetAgentTraceRecordingMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "5227d11bb82845968f994a5c646131f1",
    "id": null,
    "metadata": {},
    "name": "SettingsAgentsTracingTabSetAgentTraceRecordingMutation",
    "operationKind": "mutation",
    "text": "mutation SettingsAgentsTracingTabSetAgentTraceRecordingMutation(\n  $input: SetAgentTraceRecordingInput!\n) {\n  setAgentTraceRecording(input: $input) {\n    allowLocalTraces\n    allowRemoteExport\n  }\n}\n"
  }
};
})();

(node as any).hash = "bb81043422e4ab129b1c5982c3a7a010";

export default node;
