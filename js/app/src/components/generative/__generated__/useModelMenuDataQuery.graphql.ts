/**
 * @generated SignedSource<<905dafea60a9605dec92ceee2ace84f3>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
export type DecisionSDK = "OPENAI" | "TYPESAFE";
export type GenerativeModelSDK = "ANTHROPIC" | "AWS_BEDROCK" | "AZURE_OPENAI" | "GOOGLE_GENAI" | "OPENAI" | "TYPESAFE";
export type GenerativeProviderKey = "ANTHROPIC" | "AWS" | "AZURE_OPENAI" | "CEREBRAS" | "DEEPSEEK" | "FIREWORKS" | "GOOGLE" | "GROQ" | "META" | "MINIMAX" | "MOONSHOT" | "OLLAMA" | "OPENAI" | "PERPLEXITY" | "TOGETHER" | "TYPESAFE" | "XAI" | "ZAI";
export type ModelType = "DECISION" | "LLM";
export type useModelMenuDataQuery$variables = {
  includeDecisionModels: boolean;
};
export type useModelMenuDataQuery$data = {
  readonly decisionModels?: ReadonlyArray<{
    readonly modelType: ModelType;
    readonly name: string;
    readonly providerKey: GenerativeProviderKey;
  }>;
  readonly generativeModelCustomProviders: {
    readonly edges: ReadonlyArray<{
      readonly node: {
        readonly decisionModelNames?: ReadonlyArray<string>;
        readonly decisionSdk?: DecisionSDK | null;
        readonly id: string;
        readonly modelNames: ReadonlyArray<string>;
        readonly modelTypes: ReadonlyArray<ModelType>;
        readonly name: string;
        readonly sdk: GenerativeModelSDK;
      };
    }>;
  };
  readonly modelProviders: ReadonlyArray<{
    readonly credentialsSet: boolean;
    readonly dependenciesInstalled: boolean;
    readonly key: GenerativeProviderKey;
    readonly modelTypes: ReadonlyArray<ModelType>;
    readonly name: string;
  }>;
  readonly playgroundModels: ReadonlyArray<{
    readonly modelType: ModelType;
    readonly name: string;
    readonly providerKey: GenerativeProviderKey;
  }>;
};
export type useModelMenuDataQuery = {
  response: useModelMenuDataQuery$data;
  variables: useModelMenuDataQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "includeDecisionModels"
  }
],
v1 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "modelTypes",
  "storageKey": null
},
v3 = [
  (v1/*:: as any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "providerKey",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "modelType",
    "storageKey": null
  }
],
v4 = [
  {
    "alias": null,
    "args": null,
    "concreteType": "GenerativeModelCustomProviderConnection",
    "kind": "LinkedField",
    "name": "generativeModelCustomProviders",
    "plural": false,
    "selections": [
      {
        "alias": null,
        "args": null,
        "concreteType": "GenerativeModelCustomProviderEdge",
        "kind": "LinkedField",
        "name": "edges",
        "plural": true,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "GenerativeModelCustomProvider",
            "kind": "LinkedField",
            "name": "node",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "id",
                "storageKey": null
              },
              (v1/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "sdk",
                "storageKey": null
              },
              (v2/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "modelNames",
                "storageKey": null
              },
              {
                "condition": "includeDecisionModels",
                "kind": "Condition",
                "passingValue": true,
                "selections": [
                  {
                    "alias": "decisionModelNames",
                    "args": [
                      {
                        "kind": "Literal",
                        "name": "modelType",
                        "value": "DECISION"
                      }
                    ],
                    "kind": "ScalarField",
                    "name": "modelNames",
                    "storageKey": "modelNames(modelType:\"DECISION\")"
                  },
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "decisionSdk",
                    "storageKey": null
                  }
                ]
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "GenerativeProvider",
    "kind": "LinkedField",
    "name": "modelProviders",
    "plural": true,
    "selections": [
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "key",
        "storageKey": null
      },
      (v1/*:: as any*/),
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "dependenciesInstalled",
        "storageKey": null
      },
      {
        "alias": null,
        "args": null,
        "kind": "ScalarField",
        "name": "credentialsSet",
        "storageKey": null
      },
      (v2/*:: as any*/)
    ],
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "concreteType": "PlaygroundModel",
    "kind": "LinkedField",
    "name": "playgroundModels",
    "plural": true,
    "selections": (v3/*:: as any*/),
    "storageKey": null
  },
  {
    "condition": "includeDecisionModels",
    "kind": "Condition",
    "passingValue": true,
    "selections": [
      {
        "alias": "decisionModels",
        "args": [
          {
            "kind": "Literal",
            "name": "input",
            "value": {
              "modelType": "DECISION",
              "providerKey": null
            }
          }
        ],
        "concreteType": "PlaygroundModel",
        "kind": "LinkedField",
        "name": "playgroundModels",
        "plural": true,
        "selections": (v3/*:: as any*/),
        "storageKey": "playgroundModels(input:{\"modelType\":\"DECISION\",\"providerKey\":null})"
      }
    ]
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "useModelMenuDataQuery",
    "selections": (v4/*:: as any*/),
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "useModelMenuDataQuery",
    "selections": (v4/*:: as any*/)
  },
  "params": {
    "cacheID": "f69fd366a3c45d07191d76ddb889a5e9",
    "id": null,
    "metadata": {},
    "name": "useModelMenuDataQuery",
    "operationKind": "query",
    "text": "query useModelMenuDataQuery(\n  $includeDecisionModels: Boolean!\n) {\n  generativeModelCustomProviders {\n    edges {\n      node {\n        id\n        name\n        sdk\n        modelTypes\n        modelNames\n        decisionModelNames: modelNames(modelType: DECISION) @include(if: $includeDecisionModels)\n        decisionSdk @include(if: $includeDecisionModels)\n      }\n    }\n  }\n  modelProviders {\n    key\n    name\n    dependenciesInstalled\n    credentialsSet\n    modelTypes\n  }\n  playgroundModels {\n    name\n    providerKey\n    modelType\n  }\n  decisionModels: playgroundModels(input: {providerKey: null, modelType: DECISION}) @include(if: $includeDecisionModels) {\n    name\n    providerKey\n    modelType\n  }\n}\n"
  }
};
})();

(node as any).hash = "8f02611f9e783f455bd65d5596f361a0";

export default node;
