/**
 * @generated SignedSource<<70279240d520524f4499ffcc285ff954>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ProjectEvaluationMetricNamesSpanQuery$variables = {
  projectId: string;
};
export type ProjectEvaluationMetricNamesSpanQuery$data = {
  readonly project: {
    readonly spanAnnotationNames?: ReadonlyArray<string>;
  };
};
export type ProjectEvaluationMetricNamesSpanQuery = {
  response: ProjectEvaluationMetricNamesSpanQuery$data;
  variables: ProjectEvaluationMetricNamesSpanQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "projectId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
],
v2 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "spanAnnotationNames",
      "storageKey": null
    }
  ],
  "type": "Project",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "ProjectEvaluationMetricNamesSpanQuery",
    "selections": [
      {
        "alias": "project",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/)
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
    "name": "ProjectEvaluationMetricNamesSpanQuery",
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
          (v2/*:: as any*/),
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
    "cacheID": "d1f91a2d42aa82bcfffaa9ac1cb01202",
    "id": null,
    "metadata": {},
    "name": "ProjectEvaluationMetricNamesSpanQuery",
    "operationKind": "query",
    "text": "query ProjectEvaluationMetricNamesSpanQuery(\n  $projectId: ID!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      spanAnnotationNames\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "94e9fc46371b1860ef8895d48290b054";

export default node;
