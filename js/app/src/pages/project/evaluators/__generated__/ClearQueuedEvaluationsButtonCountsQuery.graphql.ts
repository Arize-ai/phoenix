/**
 * @generated SignedSource<<a3f150fad9f7fa427c438f4cf3b43c3a>>
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
  readonly evaluationQueue: {
    readonly queuedCount: number;
    readonly runningCount: number;
  };
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
v2 = {
  "alias": null,
  "args": null,
  "concreteType": "EvaluationQueue",
  "kind": "LinkedField",
  "name": "evaluationQueue",
  "plural": false,
  "selections": (v1/*:: as any*/),
  "storageKey": null
},
v3 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "projectId"
  }
],
v4 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "ProjectEvaluationQueue",
      "kind": "LinkedField",
      "name": "evaluationQueue",
      "plural": false,
      "selections": (v1/*:: as any*/),
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
      (v2/*:: as any*/),
      {
        "alias": "project",
        "args": (v3/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v4/*:: as any*/)
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
      (v2/*:: as any*/),
      {
        "alias": "project",
        "args": (v3/*:: as any*/),
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
          (v4/*:: as any*/),
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
    "cacheID": "080e86c4ea20865e23631c481b1e6320",
    "id": null,
    "metadata": {},
    "name": "ClearQueuedEvaluationsButtonCountsQuery",
    "operationKind": "query",
    "text": "query ClearQueuedEvaluationsButtonCountsQuery(\n  $projectId: ID!\n) {\n  evaluationQueue {\n    queuedCount\n    runningCount\n  }\n  project: node(id: $projectId) {\n    __typename\n    ... on Project {\n      evaluationQueue {\n        queuedCount\n        runningCount\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "509a9432bf4a283576cbaa7dffbe1fae";

export default node;
