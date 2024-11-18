/**
 * @generated SignedSource<<6be5e99d0c7aad6434fabbdf34a7f14b>>
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
    readonly endTime?: string;
    readonly error?: string | null;
    readonly example?: {
      readonly id: string;
      readonly revision: {
        readonly input: any;
        readonly output: any;
      };
    };
    readonly output?: any | null;
    readonly startTime?: string;
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
      "kind": "ScalarField",
      "name": "startTime",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "endTime",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "error",
      "storageKey": null
    },
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
    "cacheID": "2c749cf4e2b02f4cb4c169b59793b74b",
    "id": null,
    "metadata": {},
    "name": "PlaygroundExperimentRunDetailsDialogQuery",
    "operationKind": "query",
    "text": "query PlaygroundExperimentRunDetailsDialogQuery(\n  $runId: GlobalID!\n) {\n  run: node(id: $runId) {\n    __typename\n    ... on ExperimentRun {\n      output\n      startTime\n      endTime\n      error\n      example {\n        id\n        revision {\n          input\n          output\n        }\n      }\n    }\n    __isNode: __typename\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "7798e2e02bef64361c0eed12db25aef8";

export default node;
