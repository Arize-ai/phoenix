/**
 * @generated SignedSource<<5b4e955336160b910219c7795707f3ef>>
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
export type ExperimentActionMenuEditExperimentMutation$variables = {
  input: PatchExperimentInput;
};
export type ExperimentActionMenuEditExperimentMutation$data = {
  readonly patchExperiment: {
    readonly experiment: {
      readonly description: string | null;
      readonly id: string;
      readonly name: string;
    };
  };
};
export type ExperimentActionMenuEditExperimentMutation = {
  response: ExperimentActionMenuEditExperimentMutation$data;
  variables: ExperimentActionMenuEditExperimentMutation$variables;
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
    "name": "ExperimentActionMenuEditExperimentMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ExperimentActionMenuEditExperimentMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "bc49e5a299992c63babe5b603ab28994",
    "id": null,
    "metadata": {},
    "name": "ExperimentActionMenuEditExperimentMutation",
    "operationKind": "mutation",
    "text": "mutation ExperimentActionMenuEditExperimentMutation(\n  $input: PatchExperimentInput!\n) {\n  patchExperiment(input: $input) {\n    experiment {\n      id\n      name\n      description\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "22d7fc3c1bf79256ded3d71927942f6a";

export default node;
