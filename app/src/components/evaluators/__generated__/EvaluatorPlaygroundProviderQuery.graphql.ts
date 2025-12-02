/**
 * @generated SignedSource<<b6b043d1b954dae965bff4679669cdf3>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EvaluatorPlaygroundProviderQuery$variables = Record<PropertyKey, never>;
export type EvaluatorPlaygroundProviderQuery$data = {
  readonly modelProviders: ReadonlyArray<{
    readonly dependencies: ReadonlyArray<string>;
    readonly dependenciesInstalled: boolean;
    readonly name: string;
  }>;
};
export type EvaluatorPlaygroundProviderQuery = {
  response: EvaluatorPlaygroundProviderQuery$data;
  variables: EvaluatorPlaygroundProviderQuery$variables;
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
    "name": "EvaluatorPlaygroundProviderQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "EvaluatorPlaygroundProviderQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "d14405c14c659f9aa5edc1edb1aa694b",
    "id": null,
    "metadata": {},
    "name": "EvaluatorPlaygroundProviderQuery",
    "operationKind": "query",
    "text": "query EvaluatorPlaygroundProviderQuery {\n  modelProviders {\n    name\n    dependenciesInstalled\n    dependencies\n  }\n}\n"
  }
};
})();

(node as any).hash = "e2a15f3f5e2c1218d23664988d54db05";

export default node;
