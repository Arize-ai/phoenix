/**
 * @generated SignedSource<<c9fd199bee98dbd59e064fe7ea3c2e08>>
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
export type applyPatchExperimentMutation$variables = {
  input: PatchExperimentInput;
};
export type applyPatchExperimentMutation$data = {
  readonly patchExperiment: {
    readonly experiment: {
      readonly description: string | null;
      readonly id: string;
      readonly metadata: any;
      readonly name: string;
      readonly updatedAt: string;
    };
  };
};
export type applyPatchExperimentMutation = {
  response: applyPatchExperimentMutation$data;
  variables: applyPatchExperimentMutation$variables;
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
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "description",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "metadata",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "updatedAt",
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
    "name": "applyPatchExperimentMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "applyPatchExperimentMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "0cecb4fc6b2476cf3dc44449b4246ecf",
    "id": null,
    "metadata": {},
    "name": "applyPatchExperimentMutation",
    "operationKind": "mutation",
    "text": "mutation applyPatchExperimentMutation(\n  $input: PatchExperimentInput!\n) {\n  patchExperiment(input: $input) {\n    experiment {\n      id\n      name\n      description\n      metadata\n      updatedAt\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "9f91673120a7d7d8e4da8e5aa1357ce5";

export default node;
