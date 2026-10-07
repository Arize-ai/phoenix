/**
 * @generated SignedSource<<1efe2295c9383a6bc8b4c91798d194f9>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectOnboardingOverlayRefetchQuery$variables = {
  id: string;
};
export type ProjectOnboardingOverlayRefetchQuery$data = {
  readonly node: {
    readonly " $fragmentSpreads": FragmentRefs<"ProjectOnboardingOverlay_project">;
  };
};
export type ProjectOnboardingOverlayRefetchQuery = {
  response: ProjectOnboardingOverlayRefetchQuery$data;
  variables: ProjectOnboardingOverlayRefetchQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectOnboardingOverlayRefetchQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "ProjectOnboardingOverlay_project"
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "ProjectOnboardingOverlayRefetchQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "__typename",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          },
          {
            "kind": "InlineFragment",
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
                "name": "hasTraces",
                "storageKey": null
              }
            ],
            "type": "Project",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "8a02eaf3e4df7e7b940c1fe08bd16e92",
    "id": null,
    "metadata": {},
    "name": "ProjectOnboardingOverlayRefetchQuery",
    "operationKind": "query",
    "text": "query ProjectOnboardingOverlayRefetchQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ...ProjectOnboardingOverlay_project\n    id\n  }\n}\n\nfragment ProjectOnboardingOverlay_project on Project {\n  name\n  hasTraces\n  id\n}\n"
  }
};
})();

(node as any).hash = "5262efac4671bd7940039d22b4501829";

export default node;
