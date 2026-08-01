/**
 * @generated SignedSource<<b266309103372943c8b352cdfb0f51bf>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type GlobalEvaluatorsEmptyStateQuery$variables = Record<PropertyKey, never>;
export type GlobalEvaluatorsEmptyStateQuery$data = {
  readonly modelProviders: ReadonlyArray<{
    readonly credentialRequirements: ReadonlyArray<{
      readonly isRequired: boolean;
    }>;
    readonly credentialsSet: boolean;
  }>;
};
export type GlobalEvaluatorsEmptyStateQuery = {
  response: GlobalEvaluatorsEmptyStateQuery$data;
  variables: GlobalEvaluatorsEmptyStateQuery$variables;
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
        "name": "credentialsSet",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "GenerativeProviderCredentialConfig",
        "kind": "LinkedField",
        "name": "credentialRequirements",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "isRequired",
            "storageKey": null
          }
        ],
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
    "name": "GlobalEvaluatorsEmptyStateQuery",
    "selections": (v0/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "GlobalEvaluatorsEmptyStateQuery",
    "selections": (v0/*:: as any*/)
  },
  "params": {
    "cacheID": "36681c31ba9dab497aacb9ab61b9fc2a",
    "id": null,
    "metadata": {},
    "name": "GlobalEvaluatorsEmptyStateQuery",
    "operationKind": "query",
    "text": "query GlobalEvaluatorsEmptyStateQuery {\n  modelProviders {\n    credentialsSet\n    credentialRequirements {\n      isRequired\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "ee340d2c052fd1b04c55f5de85ac336b";

export default node;
