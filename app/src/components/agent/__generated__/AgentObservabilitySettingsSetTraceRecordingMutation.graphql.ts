/**
 * @generated SignedSource<<b2ec0a18487a0d7d362775fac8ba446f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SetAgentTraceRecordingInput = {
  allowLocalTraces: boolean;
  allowRemoteExport: boolean;
};
export type AgentObservabilitySettingsSetTraceRecordingMutation$variables = {
  input: SetAgentTraceRecordingInput;
};
export type AgentObservabilitySettingsSetTraceRecordingMutation$data = {
  readonly setAgentTraceRecording: {
    readonly allowLocalTraces: boolean;
    readonly allowRemoteExport: boolean;
  };
};
export type AgentObservabilitySettingsSetTraceRecordingMutation = {
  response: AgentObservabilitySettingsSetTraceRecordingMutation$data;
  variables: AgentObservabilitySettingsSetTraceRecordingMutation$variables;
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "AgentObservabilitySettingsSetTraceRecordingMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "AgentObservabilitySettingsSetTraceRecordingMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "c55a08cff551bf438b8b59c43f1552be",
    "id": null,
    "metadata": {},
    "name": "AgentObservabilitySettingsSetTraceRecordingMutation",
    "operationKind": "mutation",
    "text": "mutation AgentObservabilitySettingsSetTraceRecordingMutation(\n  $input: SetAgentTraceRecordingInput!\n) {\n  setAgentTraceRecording(input: $input) {\n    allowLocalTraces\n    allowRemoteExport\n  }\n}\n"
  }
};
})();

(node as any).hash = "7da93f5cfde1e3b4708442c775ab85af";

export default node;
