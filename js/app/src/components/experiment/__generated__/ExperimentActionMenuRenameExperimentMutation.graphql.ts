/**
 * @generated SignedSource<<25955b4e8a51541e43d9940351ac5162>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type PatchExperimentInput = {
  description?: string | null;
  experimentId: string;
  metadata?: any | null;
  name?: string | null;
};
export type ExperimentActionMenuRenameExperimentMutation$variables = {
  input: PatchExperimentInput;
};
export type ExperimentActionMenuRenameExperimentMutation$data = {
  readonly patchExperiment: {
    readonly experiment: {
      readonly id: string;
      readonly name: string;
    };
  };
};
export type ExperimentActionMenuRenameExperimentMutation = {
  response: ExperimentActionMenuRenameExperimentMutation$data;
  variables: ExperimentActionMenuRenameExperimentMutation$variables;
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
    "concreteType": "PatchExperimentPayload",
    "kind": "LinkedField",
    "name": "patchExperiment",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Experiment",
        "kind": "LinkedField",
        "name": "experiment",
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
            "name": "name",
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ExperimentActionMenuRenameExperimentMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ExperimentActionMenuRenameExperimentMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "341739eb1436a8ce49e72f0e4eaef78c",
    "id": null,
    "metadata": {},
    "name": "ExperimentActionMenuRenameExperimentMutation",
    "operationKind": "mutation",
    "text": "mutation ExperimentActionMenuRenameExperimentMutation(\n  $input: PatchExperimentInput!\n) {\n  patchExperiment(input: $input) {\n    experiment {\n      id\n      name\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "0dce74504eedb022d5f8444871bbf8c6";

export default node;
