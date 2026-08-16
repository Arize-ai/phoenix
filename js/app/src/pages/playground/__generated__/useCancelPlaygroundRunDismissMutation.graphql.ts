/**
 * @generated SignedSource<<9d12a284760b778b8f61a6bf9c114ef7>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type useCancelPlaygroundRunDismissMutation$variables = {
  experimentId: string;
};
export type useCancelPlaygroundRunDismissMutation$data = {
  readonly dismissExperiment: {
    readonly experiment: {
      readonly id: string;
    };
  };
};
export type useCancelPlaygroundRunDismissMutation = {
  response: useCancelPlaygroundRunDismissMutation$data;
  variables: useCancelPlaygroundRunDismissMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "experimentId"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "experimentId",
        "variableName": "experimentId"
      }
    ],
    "concreteType": "DismissExperimentPayload",
    "kind": "LinkedField",
    "name": "dismissExperiment",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Experiment",
        "kind": "LinkedField",
        "name": "experiment",
        "plural": false,
        "selections": [
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
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "useCancelPlaygroundRunDismissMutation",
    "selections": (v1/*:: as any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "useCancelPlaygroundRunDismissMutation",
    "selections": (v1/*:: as any*/)
  },
  "params": {
    "cacheID": "6a1f11d64803c201f5cda688b0a8e585",
    "id": null,
    "metadata": {},
    "name": "useCancelPlaygroundRunDismissMutation",
    "operationKind": "mutation",
    "text": "mutation useCancelPlaygroundRunDismissMutation(\n  $experimentId: ID!\n) {\n  dismissExperiment(experimentId: $experimentId) {\n    experiment {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "5465d0f006da501ffb073f5d4f48f391";

export default node;
