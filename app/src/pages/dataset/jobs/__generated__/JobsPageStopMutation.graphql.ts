/**
 * @generated SignedSource<<a2eeae1ddab0dbd02871a7a5b88490e9>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type JobsPageStopMutation$variables = {
  experimentId: string;
};
export type JobsPageStopMutation$data = {
  readonly stopExperiment: {
    readonly job: {
      readonly id: string;
      readonly isActive: boolean;
    };
  };
};
export type JobsPageStopMutation = {
  response: JobsPageStopMutation$data;
  variables: JobsPageStopMutation$variables;
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
    "name": "JobsPageStopMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "JobsPageStopMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "ad88d37f5b96cc8148554add9b76d3ae",
    "id": null,
    "metadata": {},
    "name": "JobsPageStopMutation",
    "operationKind": "mutation",
    "text": "mutation JobsPageStopMutation(\n  $experimentId: ID!\n) {\n  stopExperiment(experimentId: $experimentId) {\n    job {\n      id\n      isActive\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "5ce31090df5817c3c031e9c556e9673f";

export default node;
