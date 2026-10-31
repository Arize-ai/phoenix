/**
 * @generated SignedSource<<a90c99efceab2fb783a6ead68cf18fa0>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type PromptIndexPageQuery$variables = Record<PropertyKey, never>;
export type PromptIndexPageQuery$data = {
  readonly modelProviders: ReadonlyArray<{
    readonly dependencies: ReadonlyArray<string>;
    readonly dependenciesInstalled: boolean;
    readonly name: string;
  }>;
};
export type PromptIndexPageQuery = {
  response: PromptIndexPageQuery$data;
  variables: PromptIndexPageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "GenerativeProvider",
    "kind": "LinkedField",
    "name": "modelProviders",
    "plural": true,
    "selections": [
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
        "name": "dependenciesInstalled",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "dependencies",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "PromptIndexPageQuery",
    "selections": (v0/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "PromptIndexPageQuery",
    "selections": (v0/*:: as any*/)
  },
  "params": {
    "cacheID": "bdd58568f7eebf9710483f169c24ef57",
    "id": null,
    "metadata": {},
    "name": "PromptIndexPageQuery",
    "operationKind": "query",
    "text": "query PromptIndexPageQuery {\n  modelProviders {\n    name\n    dependenciesInstalled\n    dependencies\n  }\n}\n"
  }
};
})();

(node as any).hash = "215f35e5e03a17a0df986b6ec486017b";

export default node;
