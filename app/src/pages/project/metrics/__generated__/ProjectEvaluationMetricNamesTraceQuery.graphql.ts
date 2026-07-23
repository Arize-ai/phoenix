/**
 * @generated SignedSource<<ad96672f008cd964da93fe7072b8f94b>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ProjectEvaluationMetricNamesTraceQuery$variables = {
  projectId: string;
};
export type ProjectEvaluationMetricNamesTraceQuery$data = {
  readonly project: {
    readonly traceAnnotationsNames?: ReadonlyArray<string>;
  };
};
export type ProjectEvaluationMetricNamesTraceQuery = {
  response: ProjectEvaluationMetricNamesTraceQuery$data;
  variables: ProjectEvaluationMetricNamesTraceQuery$variables;
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
      "name": "traceAnnotationsNames",
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
    "name": "ProjectEvaluationMetricNamesTraceQuery",
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
    "name": "ProjectEvaluationMetricNamesTraceQuery",
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
    "cacheID": "f98b99e7866d3729c6b9d454400546bc",
    "id": null,
    "metadata": {},
    "name": "ProjectEvaluationMetricNamesTraceQuery",
    "operationKind": "query",
    "text": "query ProjectEvaluationMetricNamesTraceQuery(\n  $projectId: ID!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      traceAnnotationsNames\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "be6c51a804676405e2e1735629c80316";

export default node;
