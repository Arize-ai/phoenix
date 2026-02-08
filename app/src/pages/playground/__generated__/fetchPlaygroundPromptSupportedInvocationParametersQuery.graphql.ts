/**
 * @generated SignedSource<<256ab6cd7c1c6c312b99cb67bf3315cc>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type CanonicalParameterName = "ANTHROPIC_EXTENDED_THINKING" | "MAX_COMPLETION_TOKENS" | "RANDOM_SEED" | "REASONING_EFFORT" | "RESPONSE_FORMAT" | "STOP_SEQUENCES" | "TEMPERATURE" | "TOOL_CHOICE" | "TOP_P";
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "DEEPSEEK" | "GOOGLE" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "XAI";
export type InvocationInputField = "value_bool" | "value_boolean" | "value_float" | "value_int" | "value_json" | "value_string" | "value_string_list";
export type ModelsInput = {
  modelName?: string | null;
  providerKey?: GenerativeProviderKey | null;
};
export type fetchPlaygroundPromptSupportedInvocationParametersQuery$variables = {
  modelsInput: ModelsInput;
};
export type fetchPlaygroundPromptSupportedInvocationParametersQuery$data = {
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
export type fetchPlaygroundPromptSupportedInvocationParametersQuery = {
  response: fetchPlaygroundPromptSupportedInvocationParametersQuery$data;
  variables: fetchPlaygroundPromptSupportedInvocationParametersQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "modelsInput"
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
        "variableName": "modelsInput"
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
          {
            "alias": "intDefaultValue",
            "args": null,
            "kind": "ScalarField",
            "name": "defaultValue",
            "storageKey": null
          },
          (v1/*: any*/)
        ],
        "type": "IntInvocationParameter",
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
    "name": "fetchPlaygroundPromptSupportedInvocationParametersQuery",
    "selections": (v3/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "fetchPlaygroundPromptSupportedInvocationParametersQuery",
    "selections": (v3/*: any*/)
  },
  "params": {
    "cacheID": "530366c9a8cc3b47d685ca0600a39bb5",
    "id": null,
    "metadata": {},
    "name": "fetchPlaygroundPromptSupportedInvocationParametersQuery",
    "operationKind": "query",
    "text": "query fetchPlaygroundPromptSupportedInvocationParametersQuery(\n  $modelsInput: ModelsInput!\n) {\n  modelInvocationParameters(input: $modelsInput) {\n    __typename\n    ... on InvocationParameterBase {\n      __isInvocationParameterBase: __typename\n      invocationName\n      canonicalName\n      required\n      label\n    }\n    ... on BooleanInvocationParameter {\n      booleanDefaultValue: defaultValue\n      invocationInputField\n    }\n    ... on BoundedFloatInvocationParameter {\n      floatDefaultValue: defaultValue\n      invocationInputField\n      minValue\n      maxValue\n    }\n    ... on FloatInvocationParameter {\n      floatDefaultValue: defaultValue\n      invocationInputField\n    }\n    ... on IntInvocationParameter {\n      intDefaultValue: defaultValue\n      invocationInputField\n    }\n    ... on JSONInvocationParameter {\n      jsonDefaultValue: defaultValue\n      invocationInputField\n    }\n    ... on StringInvocationParameter {\n      stringDefaultValue: defaultValue\n      invocationInputField\n    }\n    ... on StringListInvocationParameter {\n      stringListDefaultValue: defaultValue\n      invocationInputField\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "1138fb98386e86196eaa52c12a6bb27c";

export default node;
