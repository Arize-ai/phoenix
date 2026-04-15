/**
 * @generated SignedSource<<5e569775dd6d69ca1c8f074190c66e94>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type Language = "PYTHON" | "TYPESCRIPT";
export type SandboxBackendStatus = "AVAILABLE" | "NOT_INSTALLED" | "UNAVAILABLE";
export type CreateCodeDatasetEvaluatorSlideoverQuery$variables = Record<PropertyKey, never>;
export type CreateCodeDatasetEvaluatorSlideoverQuery$data = {
  readonly sandboxBackends: ReadonlyArray<{
    readonly backendType: string;
    readonly status: SandboxBackendStatus;
  }>;
  readonly sandboxProviders: ReadonlyArray<{
    readonly backendType: string;
    readonly configs: ReadonlyArray<{
      readonly description: string | null;
      readonly id: string;
      readonly name: string;
    }>;
    readonly enabled: boolean;
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
  "name": "enabled",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "concreteType": "SandboxConfig",
  "kind": "LinkedField",
  "name": "configs",
  "plural": true,
  "selections": [
    (v3/*: any*/),
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
},
v5 = {
  "alias": null,
  "args": null,
  "concreteType": "SandboxBackendInfo",
  "kind": "LinkedField",
  "name": "sandboxBackends",
  "plural": true,
  "selections": [
    (v0/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "status",
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
          (v2/*: any*/),
          (v4/*: any*/)
        ],
        "storageKey": null
      },
      (v5/*: any*/)
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
          (v2/*: any*/),
          (v4/*: any*/),
          (v3/*: any*/)
        ],
        "storageKey": null
      },
      (v5/*: any*/)
    ]
  },
  "params": {
    "cacheID": "a0ca8e56dc9f78382ace98a30550e113",
    "id": null,
    "metadata": {},
    "name": "CreateCodeDatasetEvaluatorSlideoverQuery",
    "operationKind": "query",
    "text": "query CreateCodeDatasetEvaluatorSlideoverQuery {\n  sandboxProviders {\n    backendType\n    language\n    enabled\n    configs {\n      id\n      name\n      description\n    }\n    id\n  }\n  sandboxBackends {\n    backendType\n    status\n  }\n}\n"
  }
};
})();

(node as any).hash = "6dc158e2f8dcebc2e068c3d0edcb4060";

export default node;
