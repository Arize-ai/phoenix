/**
 * @generated SignedSource<<33f0dc1e96539345acbe179c8ffad59f>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectPageQueriesOnboardingQuery$variables = {
  id: string;
};
export type ProjectPageQueriesOnboardingQuery$data = {
  readonly project: {
    readonly " $fragmentSpreads": FragmentRefs<"ProjectOnboardingOverlay_project">;
  };
};
export type ProjectPageQueriesOnboardingQuery = {
  response: ProjectPageQueriesOnboardingQuery$data;
  variables: ProjectPageQueriesOnboardingQuery$variables;
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
    "name": "ProjectPageQueriesOnboardingQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "ProjectOnboardingOverlay_project"
              }
            ],
            "type": "Project",
            "abstractKey": null
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
    "name": "ProjectPageQueriesOnboardingQuery",
    "selections": [
      {
        "alias": "project",
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
    "cacheID": "74c3c36775e607899f63a907239220cb",
    "id": null,
    "metadata": {},
    "name": "ProjectPageQueriesOnboardingQuery",
    "operationKind": "query",
    "text": "query ProjectPageQueriesOnboardingQuery(\n  $id: ID!\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      ...ProjectOnboardingOverlay_project\n    }\n    id\n  }\n}\n\nfragment ProjectOnboardingOverlay_project on Project {\n  name\n  hasTraces\n  id\n}\n"
  }
};
})();

(node as any).hash = "90ef13f1e665d4862234dcf3d0842369";

export default node;
