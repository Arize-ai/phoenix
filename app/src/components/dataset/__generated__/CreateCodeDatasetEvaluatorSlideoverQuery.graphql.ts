/**
 * @generated SignedSource<<06e620c176178145fc5a3839b02c23ca>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type Language = "PYTHON" | "TYPESCRIPT";
export type CreateCodeDatasetEvaluatorSlideoverQuery$variables = Record<PropertyKey, never>;
export type CreateCodeDatasetEvaluatorSlideoverQuery$data = {
  readonly sandboxProviders: ReadonlyArray<{
    readonly backendType: string;
    readonly configs: ReadonlyArray<{
      readonly description: string | null;
      readonly id: string;
      readonly name: string;
    }>;
    readonly language: Language;
  }>;
};
export type CreateCodeDatasetEvaluatorSlideoverQuery = {
  response: CreateCodeDatasetEvaluatorSlideoverQuery$data;
  variables: CreateCodeDatasetEvaluatorSlideoverQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "backendType",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "language",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "concreteType": "SandboxConfig",
  "kind": "LinkedField",
  "name": "configs",
  "plural": true,
  "selections": [
    (v2/*: any*/),
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
      "name": "description",
      "storageKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "CreateCodeDatasetEvaluatorSlideoverQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "SandboxProvider",
        "kind": "LinkedField",
        "name": "sandboxProviders",
        "plural": true,
        "selections": [
          (v0/*: any*/),
          (v1/*: any*/),
          (v3/*: any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "CreateCodeDatasetEvaluatorSlideoverQuery",
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "SandboxProvider",
        "kind": "LinkedField",
        "name": "sandboxProviders",
        "plural": true,
        "selections": [
          (v0/*: any*/),
          (v1/*: any*/),
          (v3/*: any*/),
          (v2/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "a0d387f77418178c3e8ffb53ac0a8f53",
    "id": null,
    "metadata": {},
    "name": "CreateCodeDatasetEvaluatorSlideoverQuery",
    "operationKind": "query",
    "text": "query CreateCodeDatasetEvaluatorSlideoverQuery {\n  sandboxProviders {\n    backendType\n    language\n    configs {\n      id\n      name\n      description\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "c0a20fe4690192a61297ef66e60b100a";

export default node;
