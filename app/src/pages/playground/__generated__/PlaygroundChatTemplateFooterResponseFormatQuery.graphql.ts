/**
 * @generated SignedSource<<2003431f2625c180cb4afcf408201b62>>
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
export type PlaygroundChatTemplateFooterResponseFormatQuery$variables = {
  input: ModelsInput;
};
export type PlaygroundChatTemplateFooterResponseFormatQuery$data = {
  readonly modelInvocationParameters: ReadonlyArray<{
    readonly __typename: string;
    readonly canonicalName?: CanonicalParameterName | null;
    readonly invocationName?: string;
  }>;
};
export type PlaygroundChatTemplateFooterResponseFormatQuery = {
  response: PlaygroundChatTemplateFooterResponseFormatQuery$data;
  variables: PlaygroundChatTemplateFooterResponseFormatQuery$variables;
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
    "name": "PlaygroundChatTemplateFooterResponseFormatQuery",
    "selections": (v1/*: any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "PlaygroundChatTemplateFooterResponseFormatQuery",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "01a450b6ebf674efd1c63a87f81d527c",
    "id": null,
    "metadata": {},
    "name": "PlaygroundChatTemplateFooterResponseFormatQuery",
    "operationKind": "query",
    "text": "query PlaygroundChatTemplateFooterResponseFormatQuery(\n  $input: ModelsInput!\n) {\n  modelInvocationParameters(input: $input) {\n    __typename\n    ... on InvocationParameterBase {\n      __isInvocationParameterBase: __typename\n      invocationName\n      canonicalName\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "f66d71a8f3f680d4f0a4ec0edf0b6332";

export default node;
