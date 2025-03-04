/**
 * @generated SignedSource<<ac4d24208efec41b2608c2e7db985444>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type CanonicalParameterName = "MAX_COMPLETION_TOKENS" | "RANDOM_SEED" | "REASONING_EFFORT" | "RESPONSE_FORMAT" | "STOP_SEQUENCES" | "TEMPERATURE" | "TOOL_CHOICE" | "TOP_P";
export type GenerativeProviderKey = "ANTHROPIC" | "AZURE_OPENAI" | "GOOGLE" | "OPENAI";
export type InvocationInputField = "value_bool" | "value_boolean" | "value_float" | "value_int" | "value_json" | "value_string" | "value_string_list";
export type ModelsInput = {
  modelName?: string | null;
  providerKey?: GenerativeProviderKey | null;
};
export type ModelSupportedParamsFetcherQuery$variables = {
  input: ModelsInput;
};
export type ModelSupportedParamsFetcherQuery$data = {
  readonly modelInvocationParameters: ReadonlyArray<{
    readonly __typename: string;
    readonly booleanDefaultValue?: boolean | null;
    readonly canonicalName?: CanonicalParameterName | null;
    readonly floatDefaultValue?: number | null;
    readonly intDefaultValue?: number | null;
    readonly intMaxValue?: number;
    readonly intMinValue?: number;
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
export type ModelSupportedParamsFetcherQuery = {
  response: ModelSupportedParamsFetcherQuery$data;
  variables: ModelSupportedParamsFetcherQuery$variables;
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
v3 = {
  "alias": "intDefaultValue",
  "args": null,
  "kind": "ScalarField",
  "name": "defaultValue",
  "storageKey": null
},
v4 = [
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
            "name": "canonicalName",
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
            "name": "label",
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
            "alias": "booleanDefaultValue",
            "args": null,
            "kind": "ScalarField",
            "name": "defaultValue",
            "storageKey": null
          },
          (v1/*: any*/)
        ],
        "type": "BooleanInvocationParameter",
        "abstractKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": [
          (v2/*: any*/),
          (v1/*: any*/),
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
          }
        ],
        "type": "BoundedFloatInvocationParameter",
        "abstractKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": [
          (v2/*: any*/),
          (v1/*: any*/)
        ],
        "type": "FloatInvocationParameter",
        "abstractKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": [
          (v3/*: any*/),
          (v1/*: any*/)
        ],
        "type": "IntInvocationParameter",
        "abstractKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": [
          (v3/*: any*/),
          (v1/*: any*/),
          {
            "alias": "intMinValue",
            "args": null,
            "kind": "ScalarField",
            "name": "minValue",
            "storageKey": null
          },
          {
            "alias": "intMaxValue",
            "args": null,
            "kind": "ScalarField",
            "name": "maxValue",
            "storageKey": null
          }
        ],
        "type": "BoundedIntInvocationParameter",
        "abstractKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": [
          {
            "alias": "jsonDefaultValue",
            "args": null,
            "kind": "ScalarField",
            "name": "defaultValue",
            "storageKey": null
          },
          (v1/*: any*/)
        ],
        "type": "JSONInvocationParameter",
        "abstractKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": [
          {
            "alias": "stringDefaultValue",
            "args": null,
            "kind": "ScalarField",
            "name": "defaultValue",
            "storageKey": null
          },
          (v1/*: any*/)
        ],
        "type": "StringInvocationParameter",
        "abstractKey": null
      },
      {
        "kind": "InlineFragment",
        "selections": [
          {
            "alias": "stringListDefaultValue",
            "args": null,
            "kind": "ScalarField",
            "name": "defaultValue",
            "storageKey": null
          },
          (v1/*: any*/)
        ],
        "type": "StringListInvocationParameter",
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
    "name": "ModelSupportedParamsFetcherQuery",
    "selections": (v4/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ModelSupportedParamsFetcherQuery",
    "selections": (v4/*: any*/)
  },
  "params": {
    "cacheID": "1059c35aaa99a9e44df6b0ac2951ccf3",
    "id": null,
    "metadata": {},
    "name": "ModelSupportedParamsFetcherQuery",
    "operationKind": "query",
    "text": "query ModelSupportedParamsFetcherQuery(\n  $input: ModelsInput!\n) {\n  modelInvocationParameters(input: $input) {\n    __typename\n    ... on InvocationParameterBase {\n      __isInvocationParameterBase: __typename\n      invocationName\n      canonicalName\n      required\n      label\n    }\n    ... on BooleanInvocationParameter {\n      booleanDefaultValue: defaultValue\n      invocationInputField\n    }\n    ... on BoundedFloatInvocationParameter {\n      floatDefaultValue: defaultValue\n      invocationInputField\n      minValue\n      maxValue\n    }\n    ... on FloatInvocationParameter {\n      floatDefaultValue: defaultValue\n      invocationInputField\n    }\n    ... on IntInvocationParameter {\n      intDefaultValue: defaultValue\n      invocationInputField\n    }\n    ... on BoundedIntInvocationParameter {\n      intDefaultValue: defaultValue\n      invocationInputField\n      intMinValue: minValue\n      intMaxValue: maxValue\n    }\n    ... on JSONInvocationParameter {\n      jsonDefaultValue: defaultValue\n      invocationInputField\n    }\n    ... on StringInvocationParameter {\n      stringDefaultValue: defaultValue\n      invocationInputField\n    }\n    ... on StringListInvocationParameter {\n      stringListDefaultValue: defaultValue\n      invocationInputField\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "aeddce91b0b4f32c6db4d8d2d6ec5deb";

export default node;
