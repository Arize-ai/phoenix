/**
 * @generated SignedSource<<fadfae4fd345704382afb0820cdff3a5>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type CanonicalParameterName = "MAX_COMPLETION_TOKENS" | "RANDOM_SEED" | "RESPONSE_FORMAT" | "STOP_SEQUENCES" | "TEMPERATURE" | "TOOL_CHOICE" | "TOP_P";
export type GenerativeProviderKey = "ANTHROPIC" | "AZURE_OPENAI" | "GEMINI" | "OPENAI";
export type InvocationInputField = "value_bool" | "value_boolean" | "value_float" | "value_int" | "value_json" | "value_string" | "value_string_list";
export type ModelsInput = {
  modelName?: string | null;
  providerKey?: GenerativeProviderKey | null;
};
export type InvocationParametersFormFieldsQuery$variables = {
  input: ModelsInput;
};
export type InvocationParametersFormFieldsQuery$data = {
  readonly modelInvocationParameters: ReadonlyArray<{
    readonly __typename: string;
    readonly booleanDefaultValue?: boolean | null;
    readonly canonicalName?: CanonicalParameterName | null;
    readonly floatDefaultValue?: number | null;
    readonly intDefaultValue?: number | null;
    readonly invocationInputField?: InvocationInputField;
    readonly invocationName?: string;
    readonly jsonDefaultValue?: any | null;
    readonly label?: string;
    readonly maxValue?: number;
    readonly minValue?: number;
    readonly required?: boolean;
    readonly stringDefaultValue?: string | null;
    readonly stringListDefaultValue?: ReadonlyArray<string> | null;
  }>;
};
export type InvocationParametersFormFieldsQuery = {
  response: InvocationParametersFormFieldsQuery$data;
  variables: InvocationParametersFormFieldsQuery$variables;
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
v2 = {
  "alias": "floatDefaultValue",
  "args": null,
  "kind": "ScalarField",
  "name": "defaultValue",
  "storageKey": null
},
v3 = [
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
          (v2/*: any*/)
        ],
        "type": "BoundedFloatInvocationParameter",
        "abstractKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": [
          (v1/*: any*/),
          (v2/*: any*/)
        ],
        "type": "FloatInvocationParameter",
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
      },
      {
        "kind": "InlineFragment",
        "selections": [
          (v1/*: any*/),
          {
            "alias": "jsonDefaultValue",
            "args": null,
            "kind": "ScalarField",
            "name": "defaultValue",
            "storageKey": null
          }
        ],
        "type": "JSONInvocationParameter",
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
    "name": "InvocationParametersFormFieldsQuery",
    "selections": (v3/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "InvocationParametersFormFieldsQuery",
    "selections": (v3/*: any*/)
  },
  "params": {
    "cacheID": "4a9a1e8947463e43020c173fb6ca0418",
    "id": null,
    "metadata": {},
    "name": "InvocationParametersFormFieldsQuery",
    "operationKind": "query",
    "text": "query InvocationParametersFormFieldsQuery(\n  $input: ModelsInput!\n) {\n  modelInvocationParameters(input: $input) {\n    __typename\n    ... on InvocationParameterBase {\n      __isInvocationParameterBase: __typename\n      invocationName\n      label\n      required\n      canonicalName\n    }\n    ... on BoundedFloatInvocationParameter {\n      minValue\n      maxValue\n      invocationInputField\n      floatDefaultValue: defaultValue\n    }\n    ... on FloatInvocationParameter {\n      invocationInputField\n      floatDefaultValue: defaultValue\n    }\n    ... on IntInvocationParameter {\n      invocationInputField\n      intDefaultValue: defaultValue\n    }\n    ... on StringInvocationParameter {\n      invocationInputField\n      stringDefaultValue: defaultValue\n    }\n    ... on StringListInvocationParameter {\n      invocationInputField\n      stringListDefaultValue: defaultValue\n    }\n    ... on BooleanInvocationParameter {\n      invocationInputField\n      booleanDefaultValue: defaultValue\n    }\n    ... on JSONInvocationParameter {\n      invocationInputField\n      jsonDefaultValue: defaultValue\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "7114c972ca9a2449585281bdd7e6211c";

export default node;