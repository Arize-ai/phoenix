/**
 * @generated SignedSource<<93905137f48323f7e530a10a7b6b5398>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type layoutLoaderQuery$variables = Record<PropertyKey, never>;
export type layoutLoaderQuery$data = {
  readonly datasetCount: number;
  readonly decisionCount: number;
  readonly evaluatorCount: number;
  readonly projectCount: number;
  readonly promptCount: number;
};
export type layoutLoaderQuery = {
  response: layoutLoaderQuery$data;
  variables: layoutLoaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "projectCount",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "datasetCount",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "decisionCount",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "promptCount",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "evaluatorCount",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [],
    "kind": "Fragment",
    "metadata": null,
    "name": "layoutLoaderQuery",
    "selections": (v0/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [],
    "kind": "Operation",
    "name": "layoutLoaderQuery",
    "selections": (v0/*:: as any*/)
  },
  "params": {
    "cacheID": "81077b5476268dcae7d5b1127624c18b",
    "id": null,
    "metadata": {},
    "name": "layoutLoaderQuery",
    "operationKind": "query",
    "text": "query layoutLoaderQuery {\n  projectCount\n  datasetCount\n  decisionCount\n  promptCount\n  evaluatorCount\n}\n"
  }
};
})();

(node as any).hash = "f3fa05c07cefdaaebf9ee92437ca61c0";

export default node;
