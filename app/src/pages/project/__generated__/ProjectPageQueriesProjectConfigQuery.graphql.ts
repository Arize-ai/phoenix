/**
 * @generated SignedSource<<7a440cbc319fc3ad5ca2a7acdcefa9a9>>
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
    readonly " $fragmentSpreads": FragmentRefs<"ProjectConfigPage_projectConfigCard">;
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
    "cacheID": "92a104050258aeb9404066cf783b1888",
    "id": null,
    "metadata": {},
    "name": "ProjectPageQueriesProjectConfigQuery",
    "operationKind": "query",
    "text": "query ProjectPageQueriesProjectConfigQuery(\n  $id: GlobalID!\n) {\n  project: node(id: $id) {\n    __typename\n    ...ProjectConfigPage_projectConfigCard\n    __isNode: __typename\n    id\n  }\n}\n\nfragment ProjectConfigPage_projectConfigCard on Project {\n  id\n  name\n  gradientStartColor\n  gradientEndColor\n}\n"
  }
};
})();

(node as any).hash = "fe300a92a7895152ba48a9cf2ed207ee";

export default node;
