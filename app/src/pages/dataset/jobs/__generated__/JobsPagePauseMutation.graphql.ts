/**
 * @generated SignedSource<<883aa547148d27534f3384153731eafc>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type JobsPagePauseMutation$variables = {
  experimentId: string;
};
export type JobsPagePauseMutation$data = {
  readonly pauseExperiment: {
    readonly experimentId: string;
    readonly paused: boolean;
  };
};
export type JobsPagePauseMutation = {
  response: JobsPagePauseMutation$data;
  variables: JobsPagePauseMutation$variables;
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
    "concreteType": "PauseExperimentPayload",
    "kind": "LinkedField",
    "name": "pauseExperiment",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "experimentId",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "paused",
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "JobsPagePauseMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "JobsPagePauseMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "07e14156f0464aa8b1d416530c10ef8c",
    "id": null,
    "metadata": {},
    "name": "JobsPagePauseMutation",
    "operationKind": "mutation",
    "text": "mutation JobsPagePauseMutation(\n  $experimentId: ID!\n) {\n  pauseExperiment(experimentId: $experimentId) {\n    experimentId\n    paused\n  }\n}\n"
  }
};
})();

(node as any).hash = "edd092b139235ef978b999fea5d04aa5";

export default node;
