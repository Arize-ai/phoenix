/**
 * @generated SignedSource<<80c4fcff0552e6ff249a71cad6fcddf3>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type PlaygroundRunButtonDismissMutation$variables = {
  experimentId: string;
};
export type PlaygroundRunButtonDismissMutation$data = {
  readonly dismissExperiment: {
    readonly experiment: {
      readonly id: string;
    };
  };
};
export type PlaygroundRunButtonDismissMutation = {
  response: PlaygroundRunButtonDismissMutation$data;
  variables: PlaygroundRunButtonDismissMutation$variables;
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
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "PlaygroundRunButtonDismissMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "PlaygroundRunButtonDismissMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "fea3dfb13d99315ec07f1ace2e3516f3",
    "id": null,
    "metadata": {},
    "name": "PlaygroundRunButtonDismissMutation",
    "operationKind": "mutation",
    "text": "mutation PlaygroundRunButtonDismissMutation(\n  $experimentId: ID!\n) {\n  dismissExperiment(experimentId: $experimentId) {\n    experiment {\n      id\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "9afc3acd6a16e476b6956838b70b8be6";

export default node;
