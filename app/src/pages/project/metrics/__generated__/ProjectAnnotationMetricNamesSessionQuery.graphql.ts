/**
 * @generated SignedSource<<ff841fda9db3286940566698236da851>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ProjectAnnotationMetricNamesSessionQuery$variables = {
  projectId: string;
};
export type ProjectAnnotationMetricNamesSessionQuery$data = {
  readonly project: {
    readonly sessionAnnotationNames?: ReadonlyArray<string>;
  };
};
export type ProjectAnnotationMetricNamesSessionQuery = {
  response: ProjectAnnotationMetricNamesSessionQuery$data;
  variables: ProjectAnnotationMetricNamesSessionQuery$variables;
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
      "name": "sessionAnnotationNames",
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
    "name": "ProjectAnnotationMetricNamesSessionQuery",
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
    "name": "ProjectAnnotationMetricNamesSessionQuery",
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
    "cacheID": "257ff1fe8a350944432bca0230a76f95",
    "id": null,
    "metadata": {},
    "name": "ProjectAnnotationMetricNamesSessionQuery",
    "operationKind": "query",
    "text": "query ProjectAnnotationMetricNamesSessionQuery(\n  $projectId: ID!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      sessionAnnotationNames\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "5a02657007da0c99846346091291d4a3";

export default node;
