/**
 * @generated SignedSource<<69515074c075941350e252a18e4cc69b>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type ExperimentSelectionToolbarSetBaselineMutation$variables = {
  baseline: boolean;
  experimentId: string;
};
export type ExperimentSelectionToolbarSetBaselineMutation$data = {
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
export type ExperimentSelectionToolbarSetBaselineMutation = {
  response: ExperimentSelectionToolbarSetBaselineMutation$data;
  variables: ExperimentSelectionToolbarSetBaselineMutation$variables;
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
    "name": "ExperimentSelectionToolbarSetBaselineMutation",
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
    "name": "ExperimentSelectionToolbarSetBaselineMutation",
    "selections": (v3/*: any*/)
  },
  "params": {
    "cacheID": "d96d339f2ae5e0c5a7f61011067ea446",
    "id": null,
    "metadata": {},
    "name": "ExperimentSelectionToolbarSetBaselineMutation",
    "operationKind": "mutation",
    "text": "mutation ExperimentSelectionToolbarSetBaselineMutation(\n  $experimentId: ID!\n  $baseline: Boolean!\n) {\n  setExperimentBaseline(experimentId: $experimentId, baseline: $baseline) {\n    experiment {\n      id\n      isBaseline\n    }\n    previousBaselineExperiment {\n      id\n      isBaseline\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "dbba7218a2618c07589f13d33b9dc988";

export default node;
