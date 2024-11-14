/**
 * @generated SignedSource<<636f5568261490d37177e54159700f41>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type PlaygroundExperimentRunDetailsDialogQuery$variables = {
  runId: string;
};
export type PlaygroundExperimentRunDetailsDialogQuery$data = {
  readonly run: {
    readonly example?: {
      readonly id: string;
      readonly revision: {
        readonly input: any;
        readonly output: any;
      };
    };
    readonly output?: any | null;
  };
};
export type PlaygroundExperimentRunDetailsDialogQuery = {
  response: PlaygroundExperimentRunDetailsDialogQuery$data;
  variables: PlaygroundExperimentRunDetailsDialogQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "runId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "runId"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "output",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = {
  "kind": "InlineFragment",
  "selections": [
    (v2/*: any*/),
    {
      "alias": null,
      "args": null,
      "concreteType": "DatasetExample",
      "kind": "LinkedField",
      "name": "example",
      "plural": false,
      "selections": [
        (v3/*: any*/),
        {
          "alias": null,
          "args": null,
          "concreteType": "DatasetExampleRevision",
          "kind": "LinkedField",
          "name": "revision",
          "plural": false,
          "selections": [
            {
              "alias": null,
              "args": null,
              "kind": "ScalarField",
              "name": "input",
              "storageKey": null
            },
            (v2/*: any*/)
          ],
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "ExperimentRun",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "PlaygroundExperimentRunDetailsDialogQuery",
    "selections": [
      {
        "alias": "run",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v4/*: any*/)
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "PlaygroundExperimentRunDetailsDialogQuery",
    "selections": [
      {
        "alias": "run",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "__typename",
            "storageKey": null
          },
          (v4/*: any*/),
          {
            "kind": "TypeDiscriminator",
            "abstractKey": "__isNode"
          },
          (v3/*: any*/)
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "de3393f3f7384c6faa87696266af423c",
    "id": null,
    "metadata": {},
    "name": "PlaygroundExperimentRunDetailsDialogQuery",
    "operationKind": "query",
    "text": "query PlaygroundExperimentRunDetailsDialogQuery(\n  $runId: GlobalID!\n) {\n  run: node(id: $runId) {\n    __typename\n    ... on ExperimentRun {\n      output\n      example {\n        id\n        revision {\n          input\n          output\n        }\n      }\n    }\n    __isNode: __typename\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "1b009a10dd6d4040cd3d84e1c22d83dd";

export default node;
