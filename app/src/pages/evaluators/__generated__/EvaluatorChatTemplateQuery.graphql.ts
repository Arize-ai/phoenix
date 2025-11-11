/**
 * @generated SignedSource<<74b56c4ecd52206d48506c984c289a89>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EvaluatorChatTemplateQuery$variables = Record<PropertyKey, never>;
export type EvaluatorChatTemplateQuery$data = {
  readonly modelProviders: ReadonlyArray<{
    readonly dependencies: ReadonlyArray<string>;
    readonly dependenciesInstalled: boolean;
    readonly name: string;
  }>;
};
export type EvaluatorChatTemplateQuery = {
  response: EvaluatorChatTemplateQuery$data;
  variables: EvaluatorChatTemplateQuery$variables;
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
    "name": "EvaluatorChatTemplateQuery",
    "selections": (v0/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "EvaluatorChatTemplateQuery",
    "selections": (v0/*: any*/)
  },
  "params": {
    "cacheID": "848d5723c3176020a792a90e218e6440",
    "id": null,
    "metadata": {},
    "name": "EvaluatorChatTemplateQuery",
    "operationKind": "query",
    "text": "query EvaluatorChatTemplateQuery {\n  modelProviders {\n    name\n    dependenciesInstalled\n    dependencies\n  }\n}\n"
  }
};
})();

(node as any).hash = "5c7603303ece465623ccbb5ec9426b05";

export default node;
