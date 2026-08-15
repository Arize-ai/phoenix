/**
 * @generated SignedSource<<76a9e454352059f4c9dfb836d8bd4132>>
 * @lightSyntaxTransform
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ExperimentRunFilterConditionFieldValidationQuery",
    "selections": (v1/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ExperimentRunFilterConditionFieldValidationQuery",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "efd70fda1905f639957b01b0d1495895",
    "id": null,
    "metadata": {},
    "name": "ExperimentRunFilterConditionFieldValidationQuery",
    "operationKind": "query",
    "text": "query ExperimentRunFilterConditionFieldValidationQuery(\n  $condition: String!\n  $experimentIds: [ID!]!\n) {\n  validateExperimentRunFilterCondition(condition: $condition, experimentIds: $experimentIds) {\n    isValid\n    errorMessage\n  }\n}\n"
  }
};
})();

(node as any).hash = "76143b48e9f598432119ada0e8f29a8f";

export default node;
