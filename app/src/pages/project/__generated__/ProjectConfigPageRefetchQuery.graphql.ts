/**
 * @generated SignedSource<<d1a160ef6b1e0b06ea8af65cbc5000fc>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectConfigPageRefetchQuery$variables = {
  id: string;
};
export type ProjectConfigPageRefetchQuery$data = {
  readonly node: {
    readonly " $fragmentSpreads": FragmentRefs<"ProjectConfigPage_project">;
  };
};
export type ProjectConfigPageRefetchQuery = {
  response: ProjectConfigPageRefetchQuery$data;
  variables: ProjectConfigPageRefetchQuery$variables;
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
    "name": "ProjectConfigPageRefetchQuery",
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
            "name": "ProjectConfigPage_project"
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
    "name": "ProjectConfigPageRefetchQuery",
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
            "kind": "TypeDiscriminator",
            "abstractKey": "__isNode"
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
    "cacheID": "9b39430db16ed4c910d0696a63598db7",
    "id": null,
    "metadata": {},
    "name": "ProjectConfigPageRefetchQuery",
    "operationKind": "query",
    "text": "query ProjectConfigPageRefetchQuery(\n  $id: GlobalID!\n) {\n  node(id: $id) {\n    __typename\n    ...ProjectConfigPage_project\n    __isNode: __typename\n    id\n  }\n}\n\nfragment ProjectConfigPage_project on Project {\n  name\n  id\n}\n"
  }
};
})();

(node as any).hash = "689e9854bf02818485e0002dbcddc081";

export default node;
