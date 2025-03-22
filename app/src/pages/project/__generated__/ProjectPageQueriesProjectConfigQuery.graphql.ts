/**
 * @generated SignedSource<<0b59ea8a7bd33b67bdb35981a1299985>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type ProjectPageQueriesProjectConfigQuery$variables = {
  id: string;
};
export type ProjectPageQueriesProjectConfigQuery$data = {
  readonly project: {
    readonly " $fragmentSpreads": FragmentRefs<"ProjectConfigPage_project">;
  };
};
export type ProjectPageQueriesProjectConfigQuery = {
  response: ProjectPageQueriesProjectConfigQuery$data;
  variables: ProjectPageQueriesProjectConfigQuery$variables;
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
    "name": "ProjectPageQueriesProjectConfigQuery",
    "selections": [
      {
        "alias": "project",
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
    "name": "ProjectPageQueriesProjectConfigQuery",
    "selections": [
      {
        "alias": "project",
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
    "cacheID": "1677bceee70a37c4fbcbd01e441df78f",
    "id": null,
    "metadata": {},
    "name": "ProjectPageQueriesProjectConfigQuery",
    "operationKind": "query",
    "text": "query ProjectPageQueriesProjectConfigQuery(\n  $id: GlobalID!\n) {\n  project: node(id: $id) {\n    __typename\n    ...ProjectConfigPage_project\n    __isNode: __typename\n    id\n  }\n}\n\nfragment ProjectConfigPage_project on Project {\n  name\n  id\n}\n"
  }
};
})();

(node as any).hash = "2f05d6e70268a2139d8bf6a8570c4f93";

export default node;
