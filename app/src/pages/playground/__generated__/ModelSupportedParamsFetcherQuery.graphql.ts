/**
 * @generated SignedSource<<1b6e9d3f7c360c6eeaa1ecc8d06aed31>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Query } from 'relay-runtime';
export type CanonicalParameterName = "MAX_COMPLETION_TOKENS" | "RANDOM_SEED" | "RESPONSE_FORMAT" | "STOP_SEQUENCES" | "TEMPERATURE" | "TOOL_CHOICE" | "TOP_P";
export type GenerativeProviderKey = "ANTHROPIC" | "AZURE_OPENAI" | "GEMINI" | "OPENAI";
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
    readonly canonicalName?: CanonicalParameterName | null;
    readonly invocationName?: string;
    readonly required?: boolean;
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
v1 = [
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
          }
        ],
        "type": "InvocationParameterBase",
        "abstractKey": "__isInvocationParameterBase"
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
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "ModelSupportedParamsFetcherQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "6973f13a11ca1940b005e1c0dd17c0e3",
    "id": null,
    "metadata": {},
    "name": "ModelSupportedParamsFetcherQuery",
    "operationKind": "query",
    "text": "query ModelSupportedParamsFetcherQuery(\n  $input: ModelsInput!\n) {\n  modelInvocationParameters(input: $input) {\n    __typename\n    ... on InvocationParameterBase {\n      __isInvocationParameterBase: __typename\n      invocationName\n      canonicalName\n      required\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "b18043ce6ef1ed2ae451463564bece2f";

export default node;
