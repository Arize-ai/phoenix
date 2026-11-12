/**
 * @generated SignedSource<<139b078655813e351b69d5ca1bc95921>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type refetchEvaluatorCountsQuery$variables = Record<PropertyKey, never>;
export type refetchEvaluatorCountsQuery$data = {
  readonly datasetEvaluatorCount: number;
  readonly projectEvaluatorCount: number;
};
export type refetchEvaluatorCountsQuery = {
  response: refetchEvaluatorCountsQuery$data;
  variables: refetchEvaluatorCountsQuery$variables;
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
    "name": "refetchEvaluatorCountsQuery",
    "selections": (v0/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "refetchEvaluatorCountsQuery",
    "selections": (v0/*:: as any*/)
  },
  "params": {
    "cacheID": "05c66325c124410066946a5464066759",
    "id": null,
    "metadata": {},
    "name": "refetchEvaluatorCountsQuery",
    "operationKind": "query",
    "text": "query refetchEvaluatorCountsQuery {\n  projectEvaluatorCount\n  datasetEvaluatorCount\n}\n"
  }
};
})();

(node as any).hash = "ed64ea421c49d4bb1a24aba4ac4e701b";

export default node;
