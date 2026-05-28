/**
 * @generated SignedSource<<c2bbd6e1e8a6265db99a8e9edcb90c03>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "XAI";
export type OpenAIApiType = "CHAT_COMPLETIONS" | "RESPONSES";
export type AgentModelSelectionInput = {
  builtin?: BuiltInProviderModelSelectionInput | null;
  custom?: CustomProviderModelSelectionInput | null;
};
export type BuiltInProviderModelSelectionInput = {
  modelName: string;
  openaiApiType?: OpenAIApiType;
  provider: GenerativeProviderKey;
};
export type CustomProviderModelSelectionInput = {
  modelName: string;
  providerId: string;
};
export type useAgentModelWebSearchSupportMutation$variables = {
  model: AgentModelSelectionInput;
};
export type useAgentModelWebSearchSupportMutation$data = {
  readonly agentModelCapabilities: {
    readonly supportsWebSearch: boolean;
  };
};
export type useAgentModelWebSearchSupportMutation = {
  response: useAgentModelWebSearchSupportMutation$data;
  variables: useAgentModelWebSearchSupportMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "model"
  }
],
v1 = [
  {
    "alias": null,
    "args": [
      {
        "kind": "Variable",
        "name": "model",
        "variableName": "model"
      }
    ],
    "concreteType": "AgentModelCapabilitiesPayload",
    "kind": "LinkedField",
    "name": "agentModelCapabilities",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "supportsWebSearch",
        "storageKey": null
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
    "name": "useAgentModelWebSearchSupportMutation",
    "selections": (v1/*: any*/),
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "useAgentModelWebSearchSupportMutation",
    "selections": (v1/*: any*/)
  },
  "params": {
    "cacheID": "190bafb9150196f688fa43de7b453d61",
    "id": null,
    "metadata": {},
    "name": "useAgentModelWebSearchSupportMutation",
    "operationKind": "mutation",
    "text": "mutation useAgentModelWebSearchSupportMutation(\n  $model: AgentModelSelectionInput!\n) {\n  agentModelCapabilities(model: $model) {\n    supportsWebSearch\n  }\n}\n"
  }
};
})();

(node as any).hash = "bdb96a8a1f49090647b62a167ffdcc89";

export default node;
