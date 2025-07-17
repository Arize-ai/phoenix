/**
 * @generated SignedSource<<9fa8876a7a66fb69c61ba3f147e94154>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DeleteExperimentsInput = {
  experimentIds: ReadonlyArray<string>;
};
export type ExperimentSelectionToolbarDeleteExperimentsMutation$variables = {
  input: DeleteExperimentsInput;
};
export type ExperimentSelectionToolbarDeleteExperimentsMutation$data = {
  readonly deleteExperiments: {
    readonly __typename: "ExperimentMutationPayload";
  };
};
export type ExperimentSelectionToolbarDeleteExperimentsMutation = {
  response: ExperimentSelectionToolbarDeleteExperimentsMutation$data;
  variables: ExperimentSelectionToolbarDeleteExperimentsMutation$variables;
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ExperimentSelectionToolbarDeleteExperimentsMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ExperimentSelectionToolbarDeleteExperimentsMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "3af24cbaf3208c0d5ad1cd9313dd3823",
    "id": null,
    "metadata": {},
    "name": "ExperimentSelectionToolbarDeleteExperimentsMutation",
    "operationKind": "mutation",
    "text": "mutation ExperimentSelectionToolbarDeleteExperimentsMutation(\n  $input: DeleteExperimentsInput!\n) {\n  deleteExperiments(input: $input) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "4ab310746eb51c6a3fcb799d2c972762";

export default node;
