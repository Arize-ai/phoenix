/**
 * @generated SignedSource<<16ad6de7c865d4b87a51c17c6e00328c>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type layoutLoaderQuery$variables = Record<PropertyKey, never>;
export type layoutLoaderQuery$data = {
  readonly datasetCount: number;
  readonly datasetEvaluatorCount: number;
  readonly decisionCount: number;
  readonly projectCount: number;
  readonly projectEvaluatorCount: number;
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
    "cacheID": "0ff7c544ee0540db6a3893d5481cd6be",
    "id": null,
    "metadata": {},
    "name": "layoutLoaderQuery",
    "operationKind": "query",
    "text": "query layoutLoaderQuery {\n  projectCount\n  datasetCount\n  decisionCount\n  promptCount\n  projectEvaluatorCount\n  datasetEvaluatorCount\n}\n"
  }
};
})();

(node as any).hash = "208fc07ef499051adc08b53f4ebdc11e";

export default node;
