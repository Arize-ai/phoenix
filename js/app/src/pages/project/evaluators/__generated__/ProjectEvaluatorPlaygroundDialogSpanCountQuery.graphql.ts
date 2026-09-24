/**
 * @generated SignedSource<<ef8d15b463c9a663d509e4e670e78f4c>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ProjectEvaluatorPlaygroundDialogSpanCountQuery$variables = {
  filterCondition?: string | null;
  projectId: string;
};
export type ProjectEvaluatorPlaygroundDialogSpanCountQuery$data = {
  readonly project: {
    readonly matchingSpanCount?: number;
  };
};
export type ProjectEvaluatorPlaygroundDialogSpanCountQuery = {
  response: ProjectEvaluatorPlaygroundDialogSpanCountQuery$data;
  variables: ProjectEvaluatorPlaygroundDialogSpanCountQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "filterCondition"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "projectId"
},
v2 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
],
v3 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": "matchingSpanCount",
      "args": [
        {
          "kind": "Variable",
          "name": "filterCondition",
          "variableName": "filterCondition"
        }
      ],
      "kind": "ScalarField",
      "name": "recordCount",
      "storageKey": null
    }
  ],
  "type": "Project",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*:: as any*/),
      (v1/*:: as any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectEvaluatorPlaygroundDialogSpanCountQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v2/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v3/*:: as any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*:: as any*/),
      (v0/*:: as any*/)
    ],
    "kind": "Operation",
    "name": "ProjectEvaluatorPlaygroundDialogSpanCountQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v2/*:: as any*/),
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
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "id",
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "853bad54f0e28ce126bb8b9bc9ea98a4",
    "id": null,
    "metadata": {},
    "name": "ProjectEvaluatorPlaygroundDialogSpanCountQuery",
    "operationKind": "query",
    "text": "query ProjectEvaluatorPlaygroundDialogSpanCountQuery(\n  $projectId: ID!\n  $filterCondition: String\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      matchingSpanCount: recordCount(filterCondition: $filterCondition)\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "99c7715b08b74f668402082587b46e8c";

export default node;
