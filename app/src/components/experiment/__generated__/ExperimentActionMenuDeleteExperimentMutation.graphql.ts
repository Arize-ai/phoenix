/**
 * @generated SignedSource<<9210a7c701f6af6385678e495fb3000a>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DeleteExperimentsInput = {
  experimentIds: ReadonlyArray<string>;
};
export type ExperimentActionMenuDeleteExperimentMutation$variables = {
  connectionId: string;
  input: DeleteExperimentsInput;
};
export type ExperimentActionMenuDeleteExperimentMutation$data = {
  readonly deleteExperiments: {
    readonly __typename: "ExperimentMutationPayload";
    readonly experiments: ReadonlyArray<{
      readonly id: string;
    }>;
  };
};
export type ExperimentActionMenuDeleteExperimentMutation = {
  response: ExperimentActionMenuDeleteExperimentMutation$data;
  variables: ExperimentActionMenuDeleteExperimentMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "connectionId"
},
v1 = {
  "defaultValue": null,
  "kind": "LocalArgument",
  "name": "input"
},
v2 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": [
      (v0/*: any*/),
      (v1/*: any*/)
    ],
    "kind": "Fragment",
    "metadata": null,
    "name": "ExperimentActionMenuDeleteExperimentMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "ExperimentMutationPayload",
        "kind": "LinkedField",
        "name": "deleteExperiments",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Experiment",
            "kind": "LinkedField",
            "name": "experiments",
            "plural": true,
            "selections": [
              (v3/*: any*/)
            ],
            "storageKey": null
          },
          (v4/*: any*/)
        ],
        "storageKey": null
      }
    ],
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
    "name": "ExperimentActionMenuDeleteExperimentMutation",
    "selections": [
      {
        "alias": null,
        "args": (v2/*: any*/),
        "concreteType": "ExperimentMutationPayload",
        "kind": "LinkedField",
        "name": "deleteExperiments",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Experiment",
            "kind": "LinkedField",
            "name": "experiments",
            "plural": true,
            "selections": [
              (v3/*: any*/),
              {
                "alias": null,
                "args": null,
                "filters": null,
                "handle": "deleteEdge",
                "key": "",
                "kind": "ScalarHandle",
                "name": "id",
                "handleArgs": [
                  {
                    "items": [
                      {
                        "kind": "Variable",
                        "name": "connections.0",
                        "variableName": "connectionId"
                      }
                    ],
                    "kind": "ListValue",
                    "name": "connections"
                  }
                ]
              }
            ],
            "storageKey": null
          },
          (v4/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "8488af89f0c3e229cc6f398ab26d7fee",
    "id": null,
    "metadata": {},
    "name": "ExperimentActionMenuDeleteExperimentMutation",
    "operationKind": "mutation",
    "text": "mutation ExperimentActionMenuDeleteExperimentMutation(\n  $input: DeleteExperimentsInput!\n) {\n  deleteExperiments(input: $input) {\n    experiments {\n      id\n    }\n    __typename\n  }\n}\n"
  }
};
})();

(node as any).hash = "1cf42474b4790735463e198da5c51be3";

export default node;
