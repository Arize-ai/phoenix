/**
 * @generated SignedSource<<76acf6b3030798fc431ac9e280536929>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type EvaluatorsLayoutCountsQuery$variables = Record<PropertyKey, never>;
export type EvaluatorsLayoutCountsQuery$data = {
  readonly datasetEvaluatorCount: number;
  readonly projectEvaluatorCount: number;
};
export type EvaluatorsLayoutCountsQuery = {
  response: EvaluatorsLayoutCountsQuery$data;
  variables: EvaluatorsLayoutCountsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "projectEvaluatorCount",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "datasetEvaluatorCount",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "EvaluatorsLayoutCountsQuery",
    "selections": (v0/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "EvaluatorsLayoutCountsQuery",
    "selections": (v0/*:: as any*/)
  },
  "params": {
    "cacheID": "c963aefc89e9eaac8a0dfdaad1ae37ed",
    "id": null,
    "metadata": {},
    "name": "EvaluatorsLayoutCountsQuery",
    "operationKind": "query",
    "text": "query EvaluatorsLayoutCountsQuery {\n  projectEvaluatorCount\n  datasetEvaluatorCount\n}\n"
  }
};
})();

(node as any).hash = "b4d012a478761df27339ed8185fa454e";

export default node;
