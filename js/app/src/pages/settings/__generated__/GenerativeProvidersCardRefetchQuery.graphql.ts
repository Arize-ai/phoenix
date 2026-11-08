/**
 * @generated SignedSource<<40aae944b1619a2009a9007ae54598aa>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type GenerativeProvidersCardRefetchQuery$variables = Record<PropertyKey, never>;
export type GenerativeProvidersCardRefetchQuery$data = {
  readonly " $fragmentSpreads": FragmentRefs<"GenerativeProvidersCard_data">;
};
export type GenerativeProvidersCardRefetchQuery = {
  response: GenerativeProvidersCardRefetchQuery$data;
  variables: GenerativeProvidersCardRefetchQuery$variables;
};

const node: ConcreteRequest = {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "GenerativeProvidersCardRefetchQuery",
    "selections": [
      {
        "args": null,
        "kind": "FragmentSpread",
        "name": "GenerativeProvidersCard_data"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "GenerativeProvidersCardRefetchQuery",
    "selections": [
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
            "name": "key",
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
                "name": "envVarName",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "isRequired",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "isSetInServerEnvironment",
                "storageKey": null
              }
            ],
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "credentialsSet",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "93d5568155a7459444652e25fe9d2718",
    "id": null,
    "metadata": {},
    "name": "GenerativeProvidersCardRefetchQuery",
    "operationKind": "query",
    "text": "query GenerativeProvidersCardRefetchQuery {\n  ...GenerativeProvidersCard_data\n}\n\nfragment GenerativeProvidersCard_data on Query {\n  modelProviders {\n    name\n    key\n    dependenciesInstalled\n    dependencies\n    credentialRequirements {\n      envVarName\n      isRequired\n      isSetInServerEnvironment\n    }\n    credentialsSet\n  }\n}\n"
  }
};

(node as any).hash = "90505b62d6c29e5583fccf62df111f09";

export default node;
