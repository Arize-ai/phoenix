/**
 * @generated SignedSource<<5650e1b713bb59ebae84e8ad9eeddfa8>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type SpanFilterConditionFieldValidationQuery$variables = {
  condition: string;
};
export type SpanFilterConditionFieldValidationQuery$data = {
  readonly validateSpanFilterCondition: {
    readonly errorMessage: string | null;
    readonly isValid: boolean;
  };
};
export type SpanFilterConditionFieldValidationQuery = {
  response: SpanFilterConditionFieldValidationQuery$data;
  variables: SpanFilterConditionFieldValidationQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "condition"
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
      }
    ],
    "concreteType": "ValidationResult",
    "kind": "LinkedField",
    "name": "validateSpanFilterCondition",
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
    "name": "SpanFilterConditionFieldValidationQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "SpanFilterConditionFieldValidationQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "fed4b7622ea88f9f5db037a6e32f03e2",
    "id": null,
    "metadata": {},
    "name": "SpanFilterConditionFieldValidationQuery",
    "operationKind": "query",
    "text": "query SpanFilterConditionFieldValidationQuery(\n  $condition: String!\n) {\n  validateSpanFilterCondition(condition: $condition) {\n    isValid\n    errorMessage\n  }\n}\n"
  }
};
})();

(node as any).hash = "90f49b2d20000eda00e3374d9b4988e3";

export default node;
