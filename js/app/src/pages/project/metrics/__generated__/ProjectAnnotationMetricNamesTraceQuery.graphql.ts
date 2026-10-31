/**
 * @generated SignedSource<<66580eace49956dfb9817634ef01bfb3>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ProjectAnnotationMetricNamesTraceQuery$variables = {
  projectId: string;
};
export type ProjectAnnotationMetricNamesTraceQuery$data = {
  readonly project: {
    readonly traceAnnotationNames?: ReadonlyArray<string>;
  };
};
export type ProjectAnnotationMetricNamesTraceQuery = {
  response: ProjectAnnotationMetricNamesTraceQuery$data;
  variables: ProjectAnnotationMetricNamesTraceQuery$variables;
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
      "name": "traceAnnotationNames",
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
    "name": "ProjectAnnotationMetricNamesTraceQuery",
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
    "name": "ProjectAnnotationMetricNamesTraceQuery",
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
    "cacheID": "54f8556c177ad6793bcde706a743d3bc",
    "id": null,
    "metadata": {},
    "name": "ProjectAnnotationMetricNamesTraceQuery",
    "operationKind": "query",
    "text": "query ProjectAnnotationMetricNamesTraceQuery(\n  $projectId: ID!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      traceAnnotationNames\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "b2e59a01c9a8acf82d1048fc39078309";

export default node;
