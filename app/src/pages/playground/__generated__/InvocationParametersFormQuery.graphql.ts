/**
 * @generated SignedSource<<1e7d574479ac5b7b9fde941f3231cba0>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type CanonicalParameterName = "MAX_COMPLETION_TOKENS" | "RANDOM_SEED" | "RESPONSE_FORMAT" | "STOP_SEQUENCES" | "TEMPERATURE" | "TOOL_CHOICE" | "TOP_P";
export type GenerativeProviderKey = "ANTHROPIC" | "AZURE_OPENAI" | "OPENAI";
export type InvocationInputField = "value_bool" | "value_boolean" | "value_float" | "value_int" | "value_json" | "value_string" | "value_string_list";
export type ModelsInput = {
  modelName?: string | null;
  providerKey?: GenerativeProviderKey | null;
};
export type InvocationParametersFormQuery$variables = {
  input: ModelsInput;
};
export type InvocationParametersFormQuery$data = {
  readonly modelInvocationParameters: ReadonlyArray<{
    readonly __typename: string;
    readonly booleanDefaultValue?: boolean | null;
    readonly canonicalName?: CanonicalParameterName | null;
    readonly floatDefaultValue?: number | null;
    readonly intDefaultValue?: number | null;
    readonly invocationInputField?: InvocationInputField;
    readonly invocationName?: string;
    readonly label?: string;
    readonly maxValue?: number;
    readonly minValue?: number;
    readonly required?: boolean;
    readonly stringDefaultValue?: string | null;
    readonly stringListDefaultValue?: ReadonlyArray<string> | null;
  }>;
};
export type InvocationParametersFormQuery = {
  response: InvocationParametersFormQuery$data;
  variables: InvocationParametersFormQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "invocationInputField",
  "storageKey": null
},
v2 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "input",
        "variableName": "input"
      }
    ],
    "concreteType": null,
    "kind": "LinkedField",
    "name": "modelInvocationParameters",
    "plural": true,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "__typename",
        "storageKey": null
      },
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
            "name": "label",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "required",
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
        "selections": [
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "minValue",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "maxValue",
            "storageKey": null
          },
          (v1/*: any*/),
          {
            "alias": "floatDefaultValue",
            "args": null,
            "kind": "ScalarField",
            "name": "defaultValue",
            "storageKey": null
          }
        ],
        "type": "BoundedFloatInvocationParameter",
        "abstractKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": [
          (v1/*: any*/),
          {
            "alias": "intDefaultValue",
            "args": null,
            "kind": "ScalarField",
            "name": "defaultValue",
            "storageKey": null
          }
        ],
        "type": "IntInvocationParameter",
        "abstractKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": [
          (v1/*: any*/),
          {
            "alias": "stringDefaultValue",
            "args": null,
            "kind": "ScalarField",
            "name": "defaultValue",
            "storageKey": null
          }
        ],
        "type": "StringInvocationParameter",
        "abstractKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": [
          (v1/*: any*/),
          {
            "alias": "stringListDefaultValue",
            "args": null,
            "kind": "ScalarField",
            "name": "defaultValue",
            "storageKey": null
          }
        ],
        "type": "StringListInvocationParameter",
        "abstractKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": [
          (v1/*: any*/),
          {
            "alias": "booleanDefaultValue",
            "args": null,
            "kind": "ScalarField",
            "name": "defaultValue",
            "storageKey": null
          }
        ],
        "type": "BooleanInvocationParameter",
        "abstractKey": null
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
    "name": "InvocationParametersFormQuery",
    "selections": (v2/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "InvocationParametersFormQuery",
    "selections": (v2/*: any*/)
  },
  "params": {
    "cacheID": "3cb8a2f44047c49a75b02fa75d245cd0",
    "id": null,
    "metadata": {},
    "name": "InvocationParametersFormQuery",
    "operationKind": "query",
    "text": "query InvocationParametersFormQuery(\n  $input: ModelsInput!\n) {\n  modelInvocationParameters(input: $input) {\n    __typename\n    ... on InvocationParameterBase {\n      __isInvocationParameterBase: __typename\n      invocationName\n      label\n      required\n      canonicalName\n    }\n    ... on BoundedFloatInvocationParameter {\n      minValue\n      maxValue\n      invocationInputField\n      floatDefaultValue: defaultValue\n    }\n    ... on IntInvocationParameter {\n      invocationInputField\n      intDefaultValue: defaultValue\n    }\n    ... on StringInvocationParameter {\n      invocationInputField\n      stringDefaultValue: defaultValue\n    }\n    ... on StringListInvocationParameter {\n      invocationInputField\n      stringListDefaultValue: defaultValue\n    }\n    ... on BooleanInvocationParameter {\n      invocationInputField\n      booleanDefaultValue: defaultValue\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "83e597b9bb0c07647c9fb9b7873be073";

export default node;
