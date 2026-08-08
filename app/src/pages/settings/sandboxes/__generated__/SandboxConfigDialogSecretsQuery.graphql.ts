/**
 * @generated SignedSource<<c8ad4f513a29f6dd1c2c9f637a1eb744>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SandboxConfigDialogSecretsQuery$variables = Record<PropertyKey, never>;
export type SandboxConfigDialogSecretsQuery$data = {
  readonly secrets: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly key: string;
      };
    }>;
  };
};
export type SandboxConfigDialogSecretsQuery = {
  response: SandboxConfigDialogSecretsQuery$data;
  variables: SandboxConfigDialogSecretsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "kind": "Literal",
    "name": "first",
    "value": 200
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "key",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "SandboxConfigDialogSecretsQuery",
    "selections": [
      {
        "alias": null,
        "args": (v0/*:: as any*/),
        "concreteType": "SecretConnection",
        "kind": "LinkedField",
        "name": "secrets",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "SecretEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "Secret",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v1/*:: as any*/)
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": "secrets(first:200)"
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "SandboxConfigDialogSecretsQuery",
    "selections": [
      {
        "alias": null,
        "args": (v0/*:: as any*/),
        "concreteType": "SecretConnection",
        "kind": "LinkedField",
        "name": "secrets",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "SecretEdge",
            "kind": "LinkedField",
            "name": "edges",
            "plural": true,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "Secret",
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  (v1/*:: as any*/),
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
        "storageKey": "secrets(first:200)"
      }
    ]
  },
  "params": {
    "cacheID": "780fc9ed313b65ccb3c112fe2ac30532",
    "id": null,
    "metadata": {},
    "name": "SandboxConfigDialogSecretsQuery",
    "operationKind": "query",
    "text": "query SandboxConfigDialogSecretsQuery {\n  secrets(first: 200) {\n    edges {\n      node {\n        key\n        id\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "a253701412f45a18c885e37716ce869a";

export default node;
