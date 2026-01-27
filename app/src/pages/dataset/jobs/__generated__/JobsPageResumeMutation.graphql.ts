/**
 * @generated SignedSource<<f1ba47542e97c1c249e1dae670ba3bce>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type JobsPageResumeMutation$variables = {
  experimentId: string;
};
export type JobsPageResumeMutation$data = {
  readonly resumeExperiment: {
    readonly job: {
      readonly id: string;
      readonly isActive: boolean;
    };
  };
};
export type JobsPageResumeMutation = {
  response: JobsPageResumeMutation$data;
  variables: JobsPageResumeMutation$variables;
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
    "concreteType": "ResumeExperimentPayload",
    "kind": "LinkedField",
    "name": "resumeExperiment",
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
    "name": "JobsPageResumeMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "JobsPageResumeMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "ba3d3cdfd5b4d37d8635d77fe6f9d94f",
    "id": null,
    "metadata": {},
    "name": "JobsPageResumeMutation",
    "operationKind": "mutation",
    "text": "mutation JobsPageResumeMutation(\n  $experimentId: ID!\n) {\n  resumeExperiment(experimentId: $experimentId) {\n    job {\n      id\n      isActive\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "d570c44f8f6a96c3073521a9dfbb33b7";

export default node;
