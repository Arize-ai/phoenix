/**
 * @generated SignedSource<<3f846af886ffe642e44eecfe57237f60>>
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
    readonly name?: string;
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
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
};
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
              (v2/*:: as any*/),
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
              (v2/*:: as any*/),
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
    "cacheID": "ee8cda382cd9b541b1daa4d9570ecf4a",
    "id": null,
    "metadata": {},
    "name": "ProjectPageQueriesOnboardingQuery",
    "operationKind": "query",
    "text": "query ProjectPageQueriesOnboardingQuery(\n  $id: ID!\n) {\n  project: node(id: $id) {\n    __typename\n    ... on Project {\n      name\n      ...ProjectOnboardingOverlay_project\n    }\n    id\n  }\n}\n\nfragment ProjectOnboardingOverlay_project on Project {\n  name\n  hasTraces\n  id\n}\n"
  }
};
})();

(node as any).hash = "d71d55627ee7d4db026ba59539d54fc9";

export default node;
