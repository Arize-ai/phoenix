/**
 * @generated SignedSource<<66a1a2b8b883515014226eb121160788>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ExperimentJobStatus = "COMPLETED" | "ERROR" | "RUNNING" | "STOPPED";
export type ExperimentActionMenuStopMutation$variables = {
  experimentId: string;
};
export type ExperimentActionMenuStopMutation$data = {
  readonly stopExperiment: {
    readonly job: {
      readonly id: string;
      readonly status: ExperimentJobStatus;
    };
  };
};
export type ExperimentActionMenuStopMutation = {
  response: ExperimentActionMenuStopMutation$data;
  variables: ExperimentActionMenuStopMutation$variables;
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
    "name": "ExperimentActionMenuStopMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ExperimentActionMenuStopMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "b6d7a33582a5f2bc9540a9262a23f366",
    "id": null,
    "metadata": {},
    "name": "ExperimentActionMenuStopMutation",
    "operationKind": "mutation",
    "text": "mutation ExperimentActionMenuStopMutation(\n  $experimentId: ID!\n) {\n  stopExperiment(experimentId: $experimentId) {\n    job {\n      id\n      status\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "e87e7888315b1f593d592b772cd64990";

export default node;
