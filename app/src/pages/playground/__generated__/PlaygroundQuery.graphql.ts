/**
 * @generated SignedSource<<afe2035812d59e33aeef88825b7c2946>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type PlaygroundQuery$variables = Record<PropertyKey, never>;
export type PlaygroundQuery$data = {
  readonly modelProviders: ReadonlyArray<{
    readonly dependencies: ReadonlyArray<string>;
    readonly dependenciesInstalled: boolean;
    readonly name: string;
  }>;
};
export type PlaygroundQuery = {
  response: PlaygroundQuery$data;
  variables: PlaygroundQuery$variables;
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
    "name": "PlaygroundQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "PlaygroundQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "f19ebe151a3a9794fa2566c66751d259",
    "id": null,
    "metadata": {},
    "name": "PlaygroundQuery",
    "operationKind": "query",
    "text": "query PlaygroundQuery {\n  modelProviders {\n    name\n    dependenciesInstalled\n    dependencies\n  }\n}\n"
  }
};
})();

(node as any).hash = "9802d9d44657ca300abc1be4d0938560";

export default node;
