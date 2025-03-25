/**
<<<<<<< HEAD
 * @generated SignedSource<<7a440cbc319fc3ad5ca2a7acdcefa9a9>>
=======
 * @generated SignedSource<<0b59ea8a7bd33b67bdb35981a1299985>>
>>>>>>> 9b20ee5ffb12d884793bb8e87f17e610c1bc2408
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
<<<<<<< HEAD
    readonly " $fragmentSpreads": FragmentRefs<"ProjectConfigPage_projectConfigCard">;
=======
    readonly " $fragmentSpreads": FragmentRefs<"ProjectConfigPage_project">;
>>>>>>> 9b20ee5ffb12d884793bb8e87f17e610c1bc2408
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
<<<<<<< HEAD
            "name": "ProjectConfigPage_projectConfigCard"
=======
            "name": "ProjectConfigPage_project"
>>>>>>> 9b20ee5ffb12d884793bb8e87f17e610c1bc2408
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
<<<<<<< HEAD
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
=======
>>>>>>> 9b20ee5ffb12d884793bb8e87f17e610c1bc2408
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
<<<<<<< HEAD
    "cacheID": "92a104050258aeb9404066cf783b1888",
=======
    "cacheID": "1677bceee70a37c4fbcbd01e441df78f",
>>>>>>> 9b20ee5ffb12d884793bb8e87f17e610c1bc2408
    "id": null,
    "metadata": {},
    "name": "ProjectPageQueriesProjectConfigQuery",
    "operationKind": "query",
<<<<<<< HEAD
    "text": "query ProjectPageQueriesProjectConfigQuery(\n  $id: GlobalID!\n) {\n  project: node(id: $id) {\n    __typename\n    ...ProjectConfigPage_projectConfigCard\n    __isNode: __typename\n    id\n  }\n}\n\nfragment ProjectConfigPage_projectConfigCard on Project {\n  id\n  name\n  gradientStartColor\n  gradientEndColor\n}\n"
=======
    "text": "query ProjectPageQueriesProjectConfigQuery(\n  $id: GlobalID!\n) {\n  project: node(id: $id) {\n    __typename\n    ...ProjectConfigPage_project\n    __isNode: __typename\n    id\n  }\n}\n\nfragment ProjectConfigPage_project on Project {\n  name\n  id\n}\n"
>>>>>>> 9b20ee5ffb12d884793bb8e87f17e610c1bc2408
  }
};
})();

<<<<<<< HEAD
(node as any).hash = "fe300a92a7895152ba48a9cf2ed207ee";
=======
(node as any).hash = "2f05d6e70268a2139d8bf6a8570c4f93";
>>>>>>> 9b20ee5ffb12d884793bb8e87f17e610c1bc2408

export default node;
