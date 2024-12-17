/**
 * @generated SignedSource<<1de0c5eaf9f5783a2197d1e209cb961f>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type CanonicalParameterName = "MAX_COMPLETION_TOKENS" | "RANDOM_SEED" | "RESPONSE_FORMAT" | "STOP_SEQUENCES" | "TEMPERATURE" | "TOOL_CHOICE" | "TOP_P";
export type InvocationInputField = "value_bool" | "value_boolean" | "value_float" | "value_int" | "value_json" | "value_string" | "value_string_list";
export type spanPlaygroundPageLoaderQuery$variables = {
  spanId: string;
};
export type spanPlaygroundPageLoaderQuery$data = {
  readonly span: {
    readonly __typename: "Span";
    readonly attributes: string;
    readonly context: {
      readonly spanId: string;
      readonly traceId: string;
    };
    readonly id: string;
    readonly invocationParameters: ReadonlyArray<{
      readonly __typename: string;
      readonly canonicalName?: CanonicalParameterName | null;
      readonly invocationInputField?: InvocationInputField;
      readonly invocationName?: string;
    }>;
    readonly project: {
      readonly id: string;
      readonly name: string;
    };
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type spanPlaygroundPageLoaderQuery = {
  response: spanPlaygroundPageLoaderQuery$data;
  variables: spanPlaygroundPageLoaderQuery$variables;
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
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
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
  "alias": null,
  "args": null,
  "concreteType": "Project",
  "kind": "LinkedField",
  "name": "project",
  "plural": false,
  "selections": [
    (v3/*: any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "name",
      "storageKey": null
    }
  ],
  "storageKey": null
},
v5 = {
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
      "name": "spanId",
      "storageKey": null
    },
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
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "attributes",
  "storageKey": null
},
v7 = [
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "invocationInputField",
    "storageKey": null
  }
],
v8 = {
  "alias": null,
  "args": null,
  "concreteType": null,
  "kind": "LinkedField",
  "name": "invocationParameters",
  "plural": true,
  "selections": [
    (v2/*: any*/),
    {
      "kind": "InlineFragment",
      "selections": [
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "invocationName",
          "storageKey": null
        },
        {
          "alias": null,
          "args": null,
          "kind": "ScalarField",
          "name": "canonicalName",
          "storageKey": null
        }
      ],
      "type": "InvocationParameterBase",
      "abstractKey": "__isInvocationParameterBase"
    },
    {
      "kind": "InlineFragment",
      "selections": (v7/*: any*/),
      "type": "BooleanInvocationParameter",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": (v7/*: any*/),
      "type": "StringInvocationParameter",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": (v7/*: any*/),
      "type": "BoundedFloatInvocationParameter",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": (v7/*: any*/),
      "type": "FloatInvocationParameter",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": (v7/*: any*/),
      "type": "IntInvocationParameter",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": (v7/*: any*/),
      "type": "JSONInvocationParameter",
      "abstractKey": null
    },
    {
      "kind": "InlineFragment",
      "selections": (v7/*: any*/),
      "type": "StringListInvocationParameter",
      "abstractKey": null
    }
  ],
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "spanPlaygroundPageLoaderQuery",
    "selections": [
      {
        "alias": "span",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v3/*: any*/),
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v8/*: any*/)
            ],
            "type": "Span",
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
    "name": "spanPlaygroundPageLoaderQuery",
    "selections": [
      {
        "alias": "span",
        "args": (v1/*: any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*: any*/),
          {
            "kind": "TypeDiscriminator",
            "abstractKey": "__isNode"
          },
          (v3/*: any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              (v4/*: any*/),
              (v5/*: any*/),
              (v6/*: any*/),
              (v8/*: any*/)
            ],
            "type": "Span",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "e6a9310252c290e00bfdc12151c88b3a",
    "id": null,
    "metadata": {},
    "name": "spanPlaygroundPageLoaderQuery",
    "operationKind": "query",
    "text": "query spanPlaygroundPageLoaderQuery(\n  $spanId: GlobalID!\n) {\n  span: node(id: $spanId) {\n    __typename\n    ... on Span {\n      id\n      project {\n        id\n        name\n      }\n      context {\n        spanId\n        traceId\n      }\n      attributes\n      invocationParameters {\n        __typename\n        ... on InvocationParameterBase {\n          __isInvocationParameterBase: __typename\n          invocationName\n          canonicalName\n        }\n        ... on BooleanInvocationParameter {\n          invocationInputField\n        }\n        ... on StringInvocationParameter {\n          invocationInputField\n        }\n        ... on BoundedFloatInvocationParameter {\n          invocationInputField\n        }\n        ... on FloatInvocationParameter {\n          invocationInputField\n        }\n        ... on IntInvocationParameter {\n          invocationInputField\n        }\n        ... on JSONInvocationParameter {\n          invocationInputField\n        }\n        ... on StringListInvocationParameter {\n          invocationInputField\n        }\n      }\n    }\n    __isNode: __typename\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "65ef72eb48726c70f00811d17ea6d82d";

export default node;
