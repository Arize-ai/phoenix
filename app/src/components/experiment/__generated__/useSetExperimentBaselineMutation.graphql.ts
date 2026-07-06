/**
 * @generated SignedSource<<9b61ece2c8f95a9869b9b06e774ba510>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type useSetExperimentBaselineMutation$variables = {
  baseline: boolean;
  experimentId: string;
};
export type useSetExperimentBaselineMutation$data = {
  readonly setExperimentBaseline: {
    readonly experiment: {
      readonly id: string;
      readonly isBaseline: boolean;
    };
    readonly previousBaselineExperiment: {
      readonly id: string;
      readonly isBaseline: boolean;
    } | null;
  };
};
export type useSetExperimentBaselineMutation = {
  response: useSetExperimentBaselineMutation$data;
  variables: useSetExperimentBaselineMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "baseline"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "experimentId"
},
v2 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "id",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "isBaseline",
    "storageKey": null
  }
],
v3 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "baseline",
        "variableName": "baseline"
      },
      {
        "kind": "Variable",
        "name": "experimentId",
        "variableName": "experimentId"
      }
    ],
    "concreteType": "SetExperimentBaselinePayload",
    "kind": "LinkedField",
    "name": "setExperimentBaseline",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "Experiment",
        "kind": "LinkedField",
        "name": "experiment",
        "plural": false,
        "selections": (v2/*: any*/),
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "concreteType": "Experiment",
        "kind": "LinkedField",
        "name": "previousBaselineExperiment",
        "plural": false,
        "selections": (v2/*: any*/),
        "storageKey": null
      }
    ],
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "useSetExperimentBaselineMutation",
    "selections": (v3/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": [
      (v1/*: any*/),
      (v0/*: any*/)
    ],
    "kind": "Operation",
    "name": "useSetExperimentBaselineMutation",
    "selections": (v3/*: any*/)
  },
  "params": {
    "cacheID": "ccdb23d63a4878cb11c73881969f75b9",
    "id": null,
    "metadata": {},
    "name": "useSetExperimentBaselineMutation",
    "operationKind": "mutation",
    "text": "mutation useSetExperimentBaselineMutation(\n  $experimentId: ID!\n  $baseline: Boolean!\n) {\n  setExperimentBaseline(experimentId: $experimentId, baseline: $baseline) {\n    experiment {\n      id\n      isBaseline\n    }\n    previousBaselineExperiment {\n      id\n      isBaseline\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "b0b46f092b1fba02be2b5b7508662132";

export default node;
