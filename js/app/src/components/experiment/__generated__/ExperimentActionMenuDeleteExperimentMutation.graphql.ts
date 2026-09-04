/**
 * @generated SignedSource<<1847cba53b30551ae2679ba357ba94ab>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DeleteExperimentsInput = {
  experimentIds: ReadonlyArray<string>;
};
export type ExperimentActionMenuDeleteExperimentMutation$variables = {
  input: DeleteExperimentsInput;
};
export type ExperimentActionMenuDeleteExperimentMutation$data = {
  readonly deleteExperiments: {
    readonly __typename: "ExperimentMutationPayload";
  };
};
export type ExperimentActionMenuDeleteExperimentMutation = {
  response: ExperimentActionMenuDeleteExperimentMutation$data;
  variables: ExperimentActionMenuDeleteExperimentMutation$variables;
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
    "concreteType": "ExperimentMutationPayload",
    "kind": "LinkedField",
    "name": "deleteExperiments",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "__typename",
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
    "name": "ExperimentActionMenuDeleteExperimentMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ExperimentActionMenuDeleteExperimentMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "7fcd7830853f4b8f55b104d75dc5312b",
    "id": null,
    "metadata": {},
    "name": "ExperimentActionMenuDeleteExperimentMutation",
    "operationKind": "mutation",
    "text": "mutation ExperimentActionMenuDeleteExperimentMutation(\n  $input: DeleteExperimentsInput!\n) {\n  deleteExperiments(input: $input) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "c7f4f68f0256356c77264cc16b83e638";

export default node;
