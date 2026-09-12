/**
 * @generated SignedSource<<31cd084047f1b1acfa9b4b36c93a1504>>
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
export type EvaluatorPlaygroundProjectSelectQuery$variables = {
  filter?: ProjectFilter | null;
  hasProject: boolean;
  projectId: string;
};
export type EvaluatorPlaygroundProjectSelectQuery$data = {
  readonly projects: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly gradientEndColor: string;
        readonly gradientStartColor: string;
        readonly id: string;
        readonly name: string;
      };
    }>;
  };
  readonly selected?: {
    readonly id?: string;
    readonly name?: string;
  };
};
export type EvaluatorPlaygroundProjectSelectQuery = {
  response: EvaluatorPlaygroundProjectSelectQuery$data;
  variables: EvaluatorPlaygroundProjectSelectQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "filter"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "hasProject"
},
v2 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "projectId"
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v5 = {
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
            (v3/*:: as any*/),
            (v4/*:: as any*/),
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
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
},
v6 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/),
      (v2/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "EvaluatorPlaygroundProjectSelectQuery",
    "selections": [
      (v5/*:: as any*/),
      {
        "condition": "hasProject",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": "selected",
            "args": (v6/*:: as any*/),
            "concreteType": null,
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              {
                "kind": "InlineFragment",
                "selections": [
                  (v3/*:: as any*/),
                  (v4/*:: as any*/)
                ],
                "type": "Project",
                "abstractKey": null
              }
            ],
            "storageKey": null
          }
        ]
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v2/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "EvaluatorPlaygroundProjectSelectQuery",
    "selections": [
      (v5/*:: as any*/),
      {
        "condition": "hasProject",
        "kind": "Condition",
        "passingValue": true,
        "selections": [
          {
            "alias": "selected",
            "args": (v6/*:: as any*/),
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
              (v3/*:: as any*/),
              {
                "kind": "InlineFragment",
                "selections": [
                  (v4/*:: as any*/)
                ],
                "type": "Project",
                "abstractKey": null
              }
            ],
            "storageKey": null
          }
        ]
      }
    ]
  },
  "params": {
    "cacheID": "7f1a292c544cb078d3b6e8672c0e7ff0",
    "id": null,
    "metadata": {},
    "name": "EvaluatorPlaygroundProjectSelectQuery",
    "operationKind": "query",
    "text": "query EvaluatorPlaygroundProjectSelectQuery(\n  $filter: ProjectFilter\n  $projectId: ID!\n  $hasProject: Boolean!\n) {\n  projects(first: 50, filter: $filter) {\n    edges {\n      node {\n        id\n        name\n        gradientStartColor\n        gradientEndColor\n      }\n    }\n  }\n  selected: node(id: $projectId) @include(if: $hasProject) {\n    __typename\n    ... on Project {\n      id\n      name\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "e54caa212df02da3b746accb8a9d47ea";

export default node;
