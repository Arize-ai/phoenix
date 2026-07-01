/**
 * @generated SignedSource<<48e3b868e80e231f0922239ff2014e26>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ExperimentActionMenuSetBaselineMutation$variables = {
  baseline: boolean;
  experimentId: string;
};
export type ExperimentActionMenuSetBaselineMutation$data = {
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
export type ExperimentActionMenuSetBaselineMutation = {
  response: ExperimentActionMenuSetBaselineMutation$data;
  variables: ExperimentActionMenuSetBaselineMutation$variables;
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
    "name": "ExperimentActionMenuSetBaselineMutation",
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
    "name": "ExperimentActionMenuSetBaselineMutation",
    "selections": (v3/*: any*/)
  },
  "params": {
    "cacheID": "8fc3e1391af00a60aa6869feb9e94f47",
    "id": null,
    "metadata": {},
    "name": "ExperimentActionMenuSetBaselineMutation",
    "operationKind": "mutation",
    "text": "mutation ExperimentActionMenuSetBaselineMutation(\n  $experimentId: ID!\n  $baseline: Boolean!\n) {\n  setExperimentBaseline(experimentId: $experimentId, baseline: $baseline) {\n    experiment {\n      id\n      isBaseline\n    }\n    previousBaselineExperiment {\n      id\n      isBaseline\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "ea0f4dc2c280316c57f6dc0c0e6eff24";

export default node;
