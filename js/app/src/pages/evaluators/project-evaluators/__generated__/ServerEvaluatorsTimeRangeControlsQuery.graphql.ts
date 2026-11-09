/**
 * @generated SignedSource<<881b485c3581b544c877387e30741442>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ServerEvaluatorsTimeRangeControlsQuery$variables = Record<PropertyKey, never>;
export type ServerEvaluatorsTimeRangeControlsQuery$data = {
  readonly projectsLastUpdatedAt: string | null;
};
export type ServerEvaluatorsTimeRangeControlsQuery = {
  response: ServerEvaluatorsTimeRangeControlsQuery$data;
  variables: ServerEvaluatorsTimeRangeControlsQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "projectsLastUpdatedAt",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "ServerEvaluatorsTimeRangeControlsQuery",
    "selections": (v0/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "ServerEvaluatorsTimeRangeControlsQuery",
    "selections": (v0/*:: as any*/)
  },
  "params": {
    "cacheID": "f79a72839880ff8858b4906f0750ec34",
    "id": null,
    "metadata": {},
    "name": "ServerEvaluatorsTimeRangeControlsQuery",
    "operationKind": "query",
    "text": "query ServerEvaluatorsTimeRangeControlsQuery {\n  projectsLastUpdatedAt\n}\n"
  }
};
})();

(node as any).hash = "1e049fce6b0182c33a352e266c2f3d71";

export default node;
