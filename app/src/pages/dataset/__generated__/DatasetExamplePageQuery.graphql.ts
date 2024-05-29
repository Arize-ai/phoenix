/**
 * @generated SignedSource<<a0aaa452dfdba2b328077b49dce300ad>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type DatasetExamplePageQuery$variables = {
  exampleId: string;
};
export type DatasetExamplePageQuery$data = {
  readonly example: {
    readonly revision?: {
      readonly input: any;
      readonly metadata: any;
      readonly output: any;
    };
  };
};
export type DatasetExamplePageQuery = {
  response: DatasetExamplePageQuery$data;
  variables: DatasetExamplePageQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "exampleId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "exampleId"
  }
],
v2 = {
  "kind": "InlineFragment",
  "selections": [
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
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "output",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "metadata",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "DatasetExample",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DatasetExamplePageQuery",
    "selections": [
      {
        "alias": "example",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/)
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
    "name": "DatasetExamplePageQuery",
    "selections": [
      {
        "alias": "example",
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
          (v2/*: any*/),
          {
            "kind": "TypeDiscriminator",
            "abstractKey": "__isNode"
          },
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
    ]
  },
  "params": {
    "cacheID": "209524144ea5be096a030c1c4ac98d5b",
    "id": null,
    "metadata": {},
    "name": "DatasetExamplePageQuery",
    "operationKind": "query",
    "text": "query DatasetExamplePageQuery(\n  $exampleId: GlobalID!\n) {\n  example: node(id: $exampleId) {\n    __typename\n    ... on DatasetExample {\n      revision {\n        input\n        output\n        metadata\n      }\n    }\n    __isNode: __typename\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "848584de5ad47ce817ae579e8c9a0381";

export default node;
