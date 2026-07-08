/**
 * @generated SignedSource<<d8741a83f105a06a217f7f01579734ec>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type SpanToDatasetExampleDialogQuery$variables = {
  spanId: string;
};
export type SpanToDatasetExampleDialogQuery$data = {
  readonly span: {
    readonly revision?: {
      readonly input: any;
      readonly metadata: any;
      readonly output: any;
    };
  };
};
export type SpanToDatasetExampleDialogQuery = {
  response: SpanToDatasetExampleDialogQuery$data;
  variables: SpanToDatasetExampleDialogQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "spanId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "spanId"
  }
],
v2 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "alias": "revision",
      "args": null,
      "concreteType": "SpanAsExampleRevision",
      "kind": "LinkedField",
      "name": "asExampleRevision",
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
  "type": "Span",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "SpanToDatasetExampleDialogQuery",
    "selections": [
      {
        "alias": "span",
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
    "name": "SpanToDatasetExampleDialogQuery",
    "selections": [
      {
        "alias": "span",
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
    "cacheID": "48a0d4811a4c4fd2cf3c7114f1b04fc9",
    "id": null,
    "metadata": {},
    "name": "SpanToDatasetExampleDialogQuery",
    "operationKind": "query",
    "text": "query SpanToDatasetExampleDialogQuery(\n  $spanId: ID!\n) {\n  span: node(id: $spanId) {\n    __typename\n    ... on Span {\n      revision: asExampleRevision {\n        input\n        output\n        metadata\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "9ff195bb3e4302feb10eb48b22dfdcb1";

export default node;
