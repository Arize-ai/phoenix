/**
 * @generated SignedSource<<7d78eef4cf1de105ba7998cb6e0d0801>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectConfigPageProjectConfigCardQuery$variables = {
  id: string;
};
export type ProjectConfigPageProjectConfigCardQuery$data = {
  readonly node: {
    readonly " $fragmentSpreads": FragmentRefs<"ProjectConfigPage_projectConfigCard">;
  };
};
export type ProjectConfigPageProjectConfigCardQuery = {
  response: ProjectConfigPageProjectConfigCardQuery$data;
  variables: ProjectConfigPageProjectConfigCardQuery$variables;
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectConfigPageProjectConfigCardQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "ProjectConfigPage_projectConfigCard"
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ProjectConfigPageProjectConfigCardQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
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
                "name": "gradientStartColor",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "gradientEndColor",
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
    "cacheID": "492e0693e4facc2052015087af2e9de5",
    "id": null,
    "metadata": {},
    "name": "ProjectConfigPageProjectConfigCardQuery",
    "operationKind": "query",
    "text": "query ProjectConfigPageProjectConfigCardQuery(\n  $id: ID!\n) {\n  node(id: $id) {\n    __typename\n    ...ProjectConfigPage_projectConfigCard\n    id\n  }\n}\n\nfragment ProjectConfigPage_projectConfigCard on Project {\n  id\n  name\n  gradientStartColor\n  gradientEndColor\n}\n"
  }
};
})();

(node as any).hash = "3bd54e77e19bb08ca53696b5fc9a5c22";

export default node;
