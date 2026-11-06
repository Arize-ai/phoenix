/**
 * @generated SignedSource<<4aff4356b5eb307d48902b0ac33d7353>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type PlaygroundRunButtonCancelMutation$variables = {
  experimentId: string;
};
export type PlaygroundRunButtonCancelMutation$data = {
  readonly cancelExperiment: {
    readonly cancelled: boolean;
    readonly experimentId: string;
  };
};
export type PlaygroundRunButtonCancelMutation = {
  response: PlaygroundRunButtonCancelMutation$data;
  variables: PlaygroundRunButtonCancelMutation$variables;
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
    "concreteType": "CancelExperimentPayload",
    "kind": "LinkedField",
    "name": "cancelExperiment",
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
        "name": "cancelled",
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
    "name": "PlaygroundRunButtonCancelMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "PlaygroundRunButtonCancelMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "ac8b66cc6980731af5095fe71e8710b1",
    "id": null,
    "metadata": {},
    "name": "PlaygroundRunButtonCancelMutation",
    "operationKind": "mutation",
    "text": "mutation PlaygroundRunButtonCancelMutation(\n  $experimentId: ID!\n) {\n  cancelExperiment(experimentId: $experimentId) {\n    experimentId\n    cancelled\n  }\n}\n"
  }
};
})();

(node as any).hash = "c19d0f2be9ef0cdb573daf9f8a33fc4d";

export default node;
