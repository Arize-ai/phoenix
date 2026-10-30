/**
 * @generated SignedSource<<b29ec6f48e3130669d41984bb0a9fcf3>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ClearQueuedEvaluationsButtonAllCountsQuery$variables = Record<PropertyKey, never>;
export type ClearQueuedEvaluationsButtonAllCountsQuery$data = {
  readonly evaluationQueue: {
    readonly queuedCount: number;
    readonly runningCount: number;
  };
};
export type ClearQueuedEvaluationsButtonAllCountsQuery = {
  response: ClearQueuedEvaluationsButtonAllCountsQuery$data;
  variables: ClearQueuedEvaluationsButtonAllCountsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "EvaluationQueue",
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
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "ClearQueuedEvaluationsButtonAllCountsQuery",
    "selections": (v0/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "ClearQueuedEvaluationsButtonAllCountsQuery",
    "selections": (v0/*:: as any*/)
  },
  "params": {
    "cacheID": "68864c3931597bce84acbde3ee2d02ac",
    "id": null,
    "metadata": {},
    "name": "ClearQueuedEvaluationsButtonAllCountsQuery",
    "operationKind": "query",
    "text": "query ClearQueuedEvaluationsButtonAllCountsQuery {\n  evaluationQueue {\n    queuedCount\n    runningCount\n  }\n}\n"
  }
};
})();

(node as any).hash = "faffefb05f5ed96698c7b51ce9309188";

export default node;
