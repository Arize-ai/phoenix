/**
 * @generated SignedSource<<999cd9395ddfa21e22781214791799cd>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type PlaygroundRunButtonPauseMutation$variables = {
  experimentId: string;
};
export type PlaygroundRunButtonPauseMutation$data = {
  readonly pauseExperiment: {
    readonly experimentId: string;
    readonly paused: boolean;
  };
};
export type PlaygroundRunButtonPauseMutation = {
  response: PlaygroundRunButtonPauseMutation$data;
  variables: PlaygroundRunButtonPauseMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "experimentId"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "experimentId",
        "variableName": "experimentId"
      }
    ],
    "concreteType": "PauseExperimentPayload",
    "kind": "LinkedField",
    "name": "pauseExperiment",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "experimentId",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "paused",
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
    "name": "PlaygroundRunButtonPauseMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "PlaygroundRunButtonPauseMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "ec7eead06e82126c05013ddfc230562b",
    "id": null,
    "metadata": {},
    "name": "PlaygroundRunButtonPauseMutation",
    "operationKind": "mutation",
    "text": "mutation PlaygroundRunButtonPauseMutation(\n  $experimentId: ID!\n) {\n  pauseExperiment(experimentId: $experimentId) {\n    experimentId\n    paused\n  }\n}\n"
  }
};
})();

(node as any).hash = "e6898f199618c2eed7ecfb5116eb9b68";

export default node;
