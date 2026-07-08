/**
 * @generated SignedSource<<27db044835c931615be87b1216783e7b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ExperimentJobStatus = "COMPLETED" | "ERROR" | "RUNNING" | "STOPPED";
export type GenerativeCredentialInput = {
  envVarName: string;
  value: string;
};
export type ExperimentActionMenuResumeMutation$variables = {
  credentials?: ReadonlyArray<GenerativeCredentialInput> | null;
  experimentId: string;
};
export type ExperimentActionMenuResumeMutation$data = {
  readonly resumeExperiment: {
    readonly job: {
      readonly id: string;
      readonly status: ExperimentJobStatus;
    };
  };
};
export type ExperimentActionMenuResumeMutation = {
  response: ExperimentActionMenuResumeMutation$data;
  variables: ExperimentActionMenuResumeMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "credentials"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "experimentId"
},
v2 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "credentials",
        "variableName": "credentials"
      },
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
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "ExperimentActionMenuResumeMutation",
    "selections": (v2/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "ExperimentActionMenuResumeMutation",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "c20bb9fd454efe23c17e5394aeb1a3b8",
    "id": null,
    "metadata": {},
    "name": "ExperimentActionMenuResumeMutation",
    "operationKind": "mutation",
    "text": "mutation ExperimentActionMenuResumeMutation(\n  $experimentId: ID!\n  $credentials: [GenerativeCredentialInput!]\n) {\n  resumeExperiment(experimentId: $experimentId, credentials: $credentials) {\n    job {\n      id\n      status\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "71c6d7e32debfcbf5c4225cb381207d4";

export default node;
