/**
 * @generated SignedSource<<4a6bf1e755974d827abd859b4cbfa01f>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ClearQueuedEvaluationsMenuCountsQuery$variables = {
  projectId: string;
};
export type ClearQueuedEvaluationsMenuCountsQuery$data = {
  readonly project: {
    readonly evaluationQueue?: {
      readonly queuedCount: number;
      readonly runningCount: number;
    };
  };
};
export type ClearQueuedEvaluationsMenuCountsQuery = {
  response: ClearQueuedEvaluationsMenuCountsQuery$data;
  variables: ClearQueuedEvaluationsMenuCountsQuery$variables;
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
      "concreteType": "ProjectEvaluationQueue",
      "kind": "LinkedField",
      "name": "evaluationQueue",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "queuedCount",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "runningCount",
          "storageKey": null
        }
      ],
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
    "name": "ClearQueuedEvaluationsMenuCountsQuery",
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
    "name": "ClearQueuedEvaluationsMenuCountsQuery",
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
    "cacheID": "28c88ac70429a652e87e49a8b0479b29",
    "id": null,
    "metadata": {},
    "name": "ClearQueuedEvaluationsMenuCountsQuery",
    "operationKind": "query",
    "text": "query ClearQueuedEvaluationsMenuCountsQuery(\n  $projectId: ID!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      evaluationQueue {\n        queuedCount\n        runningCount\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "16ee069865c2222352799bb1decc70a5";

export default node;
