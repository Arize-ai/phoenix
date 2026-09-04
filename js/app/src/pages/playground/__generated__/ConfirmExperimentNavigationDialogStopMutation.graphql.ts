/**
 * @generated SignedSource<<5c480be3364ce2019ab9b2fd54b0f8d5>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ExperimentJobStatus = "COMPLETED" | "ERROR" | "RUNNING" | "STOPPED";
export type ConfirmExperimentNavigationDialogStopMutation$variables = {
  experimentId: string;
};
export type ConfirmExperimentNavigationDialogStopMutation$data = {
  readonly stopExperiment: {
    readonly job: {
      readonly id: string;
      readonly status: ExperimentJobStatus;
    };
  };
};
export type ConfirmExperimentNavigationDialogStopMutation = {
  response: ConfirmExperimentNavigationDialogStopMutation$data;
  variables: ConfirmExperimentNavigationDialogStopMutation$variables;
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
    "name": "ConfirmExperimentNavigationDialogStopMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ConfirmExperimentNavigationDialogStopMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "3fd49e4febef69832d8a497ada6d3da3",
    "id": null,
    "metadata": {},
    "name": "ConfirmExperimentNavigationDialogStopMutation",
    "operationKind": "mutation",
    "text": "mutation ConfirmExperimentNavigationDialogStopMutation(\n  $experimentId: ID!\n) {\n  stopExperiment(experimentId: $experimentId) {\n    job {\n      id\n      status\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "aff97da52789eff8e5e65c04138082e6";

export default node;
