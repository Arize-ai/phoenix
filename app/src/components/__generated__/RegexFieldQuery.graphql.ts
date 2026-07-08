/**
 * @generated SignedSource<<2a632e3092afe70f1b927c281d032656>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type RegexFieldQuery$variables = {
  input: string;
};
export type RegexFieldQuery$data = {
  readonly validateRegularExpression: {
    readonly errorMessage: string | null;
    readonly isValid: boolean;
  };
};
export type RegexFieldQuery = {
  response: RegexFieldQuery$data;
  variables: RegexFieldQuery$variables;
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
        "name": "regex",
        "variableName": "input"
      }
    ],
    "concreteType": "ValidationResult",
    "kind": "LinkedField",
    "name": "validateRegularExpression",
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
    "name": "RegexFieldQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "RegexFieldQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "a194706b4bec602eb34e8e12671ec9b7",
    "id": null,
    "metadata": {},
    "name": "RegexFieldQuery",
    "operationKind": "query",
    "text": "query RegexFieldQuery(\n  $input: String!\n) {\n  validateRegularExpression(regex: $input) {\n    isValid\n    errorMessage\n  }\n}\n"
  }
};
})();

(node as any).hash = "588f0ae4347a5d65fd17babc2d6be11f";

export default node;
