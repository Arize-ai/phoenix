/**
 * @generated SignedSource<<2369e1974f9b15b81e0416ae70f73426>>
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
export type ConfirmExperimentNavigationDialogDeleteMutation$variables = {
  input: DeleteExperimentsInput;
};
export type ConfirmExperimentNavigationDialogDeleteMutation$data = {
  readonly deleteExperiments: {
    readonly __typename: "ExperimentMutationPayload";
  };
};
export type ConfirmExperimentNavigationDialogDeleteMutation = {
  response: ConfirmExperimentNavigationDialogDeleteMutation$data;
  variables: ConfirmExperimentNavigationDialogDeleteMutation$variables;
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
    "name": "ConfirmExperimentNavigationDialogDeleteMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ConfirmExperimentNavigationDialogDeleteMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "1518c22af98a03bc48239cd6da4c5bc4",
    "id": null,
    "metadata": {},
    "name": "ConfirmExperimentNavigationDialogDeleteMutation",
    "operationKind": "mutation",
    "text": "mutation ConfirmExperimentNavigationDialogDeleteMutation(\n  $input: DeleteExperimentsInput!\n) {\n  deleteExperiments(input: $input) {\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "0930630c5bd6c17dc8b6605bfd5fe01e";

export default node;
