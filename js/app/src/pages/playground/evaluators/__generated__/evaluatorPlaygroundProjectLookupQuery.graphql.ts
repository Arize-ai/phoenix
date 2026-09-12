/**
 * @generated SignedSource<<60d87be54d7886d941dba60fd591e4b6>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ProjectFilterColumn = "name";
export type ProjectFilter = {
  col: ProjectFilterColumn;
  value: string;
};
export type evaluatorPlaygroundProjectLookupQuery$variables = {
  filter: ProjectFilter;
};
export type evaluatorPlaygroundProjectLookupQuery$data = {
  readonly projects: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly id: string;
        readonly name: string;
      };
    }>;
  };
};
export type evaluatorPlaygroundProjectLookupQuery = {
  response: evaluatorPlaygroundProjectLookupQuery$data;
  variables: evaluatorPlaygroundProjectLookupQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "filter"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "filter",
        "variableName": "filter"
      },
      {
        "kind": "Literal",
        "name": "first",
        "value": 50
      }
    ],
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
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "id",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "name",
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "evaluatorPlaygroundProjectLookupQuery",
    "selections": (v1/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "evaluatorPlaygroundProjectLookupQuery",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "e4de7b326f354b03ec54575d1ea03163",
    "id": null,
    "metadata": {},
    "name": "evaluatorPlaygroundProjectLookupQuery",
    "operationKind": "query",
    "text": "query evaluatorPlaygroundProjectLookupQuery(\n  $filter: ProjectFilter!\n) {\n  projects(first: 50, filter: $filter) {\n    edges {\n      node {\n        id\n        name\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "71a8e673481c50e0396bcfa150feee58";

export default node;
