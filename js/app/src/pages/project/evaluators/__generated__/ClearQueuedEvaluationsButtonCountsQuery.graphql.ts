/**
 * @generated SignedSource<<a3c971b7b58678e88bcc37026e724d0c>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ClearQueuedEvaluationsButtonCountsQuery$variables = {
  projectId: string;
};
export type ClearQueuedEvaluationsButtonCountsQuery$data = {
  readonly project: {
    readonly evaluationQueue?: {
      readonly queuedCount: number;
      readonly runningCount: number;
    };
  };
};
export type ClearQueuedEvaluationsButtonCountsQuery = {
  response: ClearQueuedEvaluationsButtonCountsQuery$data;
  variables: ClearQueuedEvaluationsButtonCountsQuery$variables;
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
    "name": "ClearQueuedEvaluationsButtonCountsQuery",
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
    "name": "ClearQueuedEvaluationsButtonCountsQuery",
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
    "cacheID": "39c6205ffd9797296489bf24ae37501c",
    "id": null,
    "metadata": {},
    "name": "ClearQueuedEvaluationsButtonCountsQuery",
    "operationKind": "query",
    "text": "query ClearQueuedEvaluationsButtonCountsQuery(\n  $projectId: ID!\n) {\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      evaluationQueue {\n        queuedCount\n        runningCount\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "f90fc4b0ab0d8abb9554c33ba3c6bdee";

export default node;
