/**
 * @generated SignedSource<<4b12a8bfe797e62fe761c2a35ce8a69f>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type HomePageQuery$variables = Record<PropertyKey, never>;
export type HomePageQuery$data = {
  readonly datasetCount: number;
  readonly evaluatorCount: number;
  readonly modelProviders: ReadonlyArray<{
    readonly credentialRequirements: ReadonlyArray<{
      readonly isRequired: boolean;
    }>;
    readonly credentialsSet: boolean;
  }>;
  readonly projects: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly traceCount: number;
      };
    }>;
  };
};
export type HomePageQuery = {
  response: HomePageQuery$data;
  variables: HomePageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "datasetCount",
  "storageKey": null
},
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "evaluatorCount",
  "storageKey": null
},
v2 = {
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
},
v3 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 100
  }
],
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "traceCount",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "HomePageQuery",
    "selections": [
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/),
      {
        "alias": null,
        "args": (v3/*:: as any*/),
        "concreteType": "ProjectConnection",
        "kind": "LinkedField",
        "name": "projects",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "ProjectEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "Project",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v4/*:: as any*/)
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": "projects(first:100)"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "HomePageQuery",
    "selections": [
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/),
      {
        "alias": null,
        "args": (v3/*:: as any*/),
        "concreteType": "ProjectConnection",
        "kind": "LinkedField",
        "name": "projects",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "ProjectEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "Project",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v4/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "id",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": "projects(first:100)"
      }
    ]
  },
  "params": {
    "cacheID": "e2b83aab95c8e9689915e9bbe392f6d9",
    "id": null,
    "metadata": {},
    "name": "HomePageQuery",
    "operationKind": "query",
    "text": "query HomePageQuery {\n  datasetCount\n  evaluatorCount\n  modelProviders {\n    credentialsSet\n    credentialRequirements {\n      isRequired\n    }\n  }\n  projects(first: 100) {\n    edges {\n      node {\n        traceCount\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "5ea1bc563651fbe765c0925c06bb4ca4";

export default node;
