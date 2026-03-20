/**
 * @generated SignedSource<<db9e13e0ad8ade04c3ba26d67b7a172e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type PlaygroundRunButtonStopMutation$variables = {
  experimentId: string;
};
export type PlaygroundRunButtonStopMutation$data = {
  readonly stopExperiment: {
    readonly job: {
      readonly id: string;
      readonly isActive: boolean;
    };
  };
};
export type PlaygroundRunButtonStopMutation = {
  response: PlaygroundRunButtonStopMutation$data;
  variables: PlaygroundRunButtonStopMutation$variables;
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
    "concreteType": "StopExperimentPayload",
    "kind": "LinkedField",
    "name": "stopExperiment",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "ExperimentJob",
        "kind": "LinkedField",
        "name": "job",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "isActive",
            "storageKey": null
          }
        ],
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
    "name": "PlaygroundRunButtonStopMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "PlaygroundRunButtonStopMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "3bd628039f3d9e31f57de079b95d1277",
    "id": null,
    "metadata": {},
    "name": "PlaygroundRunButtonStopMutation",
    "operationKind": "mutation",
    "text": "mutation PlaygroundRunButtonStopMutation(\n  $experimentId: ID!\n) {\n  stopExperiment(experimentId: $experimentId) {\n    job {\n      id\n      isActive\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "0219cb1a6d54e0451956d0c85cbf1b58";

export default node;
