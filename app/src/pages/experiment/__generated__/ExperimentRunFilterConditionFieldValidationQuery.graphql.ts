/**
 * @generated SignedSource<<94f98c467593a0fa983c16b81eb884fa>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ExperimentRunFilterConditionFieldValidationQuery$variables = {
  condition: string;
  experimentIds: ReadonlyArray<string>;
};
export type ExperimentRunFilterConditionFieldValidationQuery$data = {
  readonly validateExperimentRunFilterCondition: {
    readonly errorMessage: string | null;
    readonly isValid: boolean;
  };
};
export type ExperimentRunFilterConditionFieldValidationQuery = {
  response: ExperimentRunFilterConditionFieldValidationQuery$data;
  variables: ExperimentRunFilterConditionFieldValidationQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "condition"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "experimentIds"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "condition",
        "variableName": "condition"
      },
      {
        "kind": "Variable",
        "name": "experimentIds",
        "variableName": "experimentIds"
      }
    ],
    "concreteType": "ValidationResult",
    "kind": "LinkedField",
    "name": "validateExperimentRunFilterCondition",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "isValid",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "errorMessage",
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
    "name": "ExperimentRunFilterConditionFieldValidationQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ExperimentRunFilterConditionFieldValidationQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "215d8f5d35b74d08ed0935cc97450385",
    "id": null,
    "metadata": {},
    "name": "ExperimentRunFilterConditionFieldValidationQuery",
    "operationKind": "query",
    "text": "query ExperimentRunFilterConditionFieldValidationQuery(\n  $condition: String!\n  $experimentIds: [GlobalID!]!\n) {\n  validateExperimentRunFilterCondition(condition: $condition, experimentIds: $experimentIds) {\n    isValid\n    errorMessage\n  }\n}\n"
  }
};
})();

(node as any).hash = "ebd42c04f1fa695bbd658ed88c167854";

export default node;
