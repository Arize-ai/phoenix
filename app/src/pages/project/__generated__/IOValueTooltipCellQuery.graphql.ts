/**
 * @generated SignedSource<<7a9f0f0fda69291ebca3571f5a5b6a16>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type IOValueTooltipCellQuery$variables = {
  id: string;
  includeInput: boolean;
  includeOutput: boolean;
};
export type IOValueTooltipCellQuery$data = {
  readonly node: {
    readonly __typename: "ProjectSession";
    readonly firstInput?: {
      readonly value: string;
    } | null;
    readonly lastOutput?: {
      readonly value: string;
    } | null;
  } | {
    readonly __typename: "Span";
    readonly input?: {
      readonly value: string;
    } | null;
    readonly output?: {
      readonly value: string;
    } | null;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type IOValueTooltipCellQuery = {
  response: IOValueTooltipCellQuery$data;
  variables: IOValueTooltipCellQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "includeInput"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "includeOutput"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v3 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "value",
    "storageKey": null
  }
],
v4 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "condition": "includeInput",
      "kind": "Condition",
      "passingValue": true,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "SpanIOValue",
          "kind": "LinkedField",
          "name": "input",
          "plural": false,
          "selections": (v3/*: any*/),
          "storageKey": null
        }
      ]
    },
    {
      "condition": "includeOutput",
      "kind": "Condition",
      "passingValue": true,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "SpanIOValue",
          "kind": "LinkedField",
          "name": "output",
          "plural": false,
          "selections": (v3/*: any*/),
          "storageKey": null
        }
      ]
    }
  ],
  "type": "Span",
  "abstractKey": null
},
v5 = {
  "kind": "InlineFragment",
  "selections": [
    {
      "condition": "includeInput",
      "kind": "Condition",
      "passingValue": true,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "SpanIOValue",
          "kind": "LinkedField",
          "name": "firstInput",
          "plural": false,
          "selections": (v3/*: any*/),
          "storageKey": null
        }
      ]
    },
    {
      "condition": "includeOutput",
      "kind": "Condition",
      "passingValue": true,
      "selections": [
        {
          "alias": null,
          "args": null,
          "concreteType": "SpanIOValue",
          "kind": "LinkedField",
          "name": "lastOutput",
          "plural": false,
          "selections": (v3/*: any*/),
          "storageKey": null
        }
      ]
    }
  ],
  "type": "ProjectSession",
  "abstractKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "IOValueTooltipCellQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v4/*: any*/),
          (v5/*: any*/)
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
    "name": "IOValueTooltipCellQuery",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          (v4/*: any*/),
          (v5/*: any*/),
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
    "cacheID": "09ad8a38793d04961ffa8b296e335248",
    "id": null,
    "metadata": {},
    "name": "IOValueTooltipCellQuery",
    "operationKind": "query",
    "text": "query IOValueTooltipCellQuery(\n  $id: ID!\n  $includeInput: Boolean!\n  $includeOutput: Boolean!\n) {\n  node(id: $id) {\n    __typename\n    ... on Span {\n      input @include(if: $includeInput) {\n        value\n      }\n      output @include(if: $includeOutput) {\n        value\n      }\n    }\n    ... on ProjectSession {\n      firstInput @include(if: $includeInput) {\n        value\n      }\n      lastOutput @include(if: $includeOutput) {\n        value\n      }\n    }\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "e91ceedef807af136d84252b3b1e1b6f";

export default node;
