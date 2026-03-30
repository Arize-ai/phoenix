/**
 * @generated SignedSource<<5d02fdfb3aa15cf08206397d86307311>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ExperimentJobStatus = "COMPLETED" | "ERROR" | "RUNNING" | "STOPPED";
export type PlaygroundRunButtonStopMutation$variables = {
  experimentId: string;
};
export type PlaygroundRunButtonStopMutation$data = {
  readonly stopExperiment: {
    readonly job: {
      readonly id: string;
      readonly status: ExperimentJobStatus;
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
            "name": "status",
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
    "cacheID": "45c8f2b0c22f31521c9fc8080e08acaa",
    "id": null,
    "metadata": {},
    "name": "PlaygroundRunButtonStopMutation",
    "operationKind": "mutation",
    "text": "mutation PlaygroundRunButtonStopMutation(\n  $experimentId: ID!\n) {\n  stopExperiment(experimentId: $experimentId) {\n    job {\n      id\n      status\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "2a4c2157440318d998cd2de8825bdf42";

export default node;
