/**
 * @generated SignedSource<<97a611dd309043306668dba8975e2e44>>
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
    readonly id?: string;
    readonly latestRevision?: {
      readonly input: any;
      readonly metadata: any;
      readonly output: any;
    };
    readonly span?: {
      readonly context: {
        readonly traceId: string;
      };
      readonly project: {
        readonly id: string;
      };
    } | null;
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
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "alias": "latestRevision",
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
},
v4 = {
  "alias": null,
  "args": null,
  "concreteType": "Span",
  "kind": "LinkedField",
  "name": "span",
  "plural": false,
  "selections": [
    {
      "alias": null,
      "args": null,
      "concreteType": "SpanContext",
      "kind": "LinkedField",
      "name": "context",
      "plural": false,
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "traceId",
          "storageKey": null
        }
      ],
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "Project",
      "kind": "LinkedField",
      "name": "project",
      "plural": false,
      "selections": [
        (v2/*: any*/)
      ],
      "storageKey": null
    }
  ],
  "storageKey": null
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
          {
            "kind": "InlineFragment",
            "selections": [
              (v2/*: any*/),
              (v3/*: any*/),
              (v4/*: any*/)
            ],
            "type": "DatasetExample",
            "abstractKey": null
          }
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
          {
            "kind": "TypeDiscriminator",
            "abstractKey": "__isNode"
          },
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/)
            ],
            "type": "DatasetExample",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "6791821dcb3e6b94d51eea4152148b79",
    "id": null,
    "metadata": {},
    "name": "DatasetExamplePageQuery",
    "operationKind": "query",
    "text": "query DatasetExamplePageQuery(\n  $exampleId: GlobalID!\n) {\n  example: node(id: $exampleId) {\n    __typename\n    ... on DatasetExample {\n      id\n      latestRevision: revision {\n        input\n        output\n        metadata\n      }\n      span {\n        context {\n          traceId\n        }\n        project {\n          id\n        }\n      }\n    }\n    __isNode: __typename\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "92fb7507b7ebdb125d72e1c74b1efc4b";

export default node;
