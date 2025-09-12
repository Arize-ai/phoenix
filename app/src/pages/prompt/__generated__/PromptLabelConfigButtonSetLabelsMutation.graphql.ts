/**
 * @generated SignedSource<<01e82e6c89338d07b757ef4baf97782d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SetPromptLabelsInput = {
  promptId: string;
  promptLabelIds: ReadonlyArray<string>;
};
export type PromptLabelConfigButtonSetLabelsMutation$variables = {
  newPromptLabelsDef: SetPromptLabelsInput;
  promptId: string;
};
export type PromptLabelConfigButtonSetLabelsMutation$data = {
  readonly setPromptLabels: {
    readonly query: {
      readonly prompt: {
        readonly " $fragmentSpreads": FragmentRefs<"PromptLabels">;
      };
      readonly " $fragmentSpreads": FragmentRefs<"PromptLabelConfigButton_labels">;
    };
  };
};
export type PromptLabelConfigButtonSetLabelsMutation = {
  response: PromptLabelConfigButtonSetLabelsMutation$data;
  variables: PromptLabelConfigButtonSetLabelsMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "newPromptLabelsDef"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "promptId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "newPromptLabelsDef"
  }
],
v2 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "promptId"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v4 = [
  (v3/*: any*/),
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "name",
    "storageKey": null
  },
  {
    "alias": null,
    "args": null,
    "kind": "ScalarField",
    "name": "color",
    "storageKey": null
  }
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "PromptLabelConfigButtonSetLabelsMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "PromptLabelMutationPayload",
        "kind": "LinkedField",
        "name": "setPromptLabels",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "args": [
                  {
                    "kind": "Variable",
                    "name": "promptId",
                    "variableName": "promptId"
                  }
                ],
                "kind": "FragmentSpread",
                "name": "PromptLabelConfigButton_labels"
              },
              {
                "alias": "prompt",
                "args": (v2/*: any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "args": null,
                        "kind": "FragmentSpread",
                        "name": "PromptLabels"
                      }
                    ],
                    "type": "Prompt",
                    "abstractKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Mutation",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Operation",
    "name": "PromptLabelConfigButtonSetLabelsMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "PromptLabelMutationPayload",
        "kind": "LinkedField",
        "name": "setPromptLabels",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Query",
            "kind": "LinkedField",
            "name": "query",
            "plural": false,
            "selections": [
              {
                "alias": "prompt",
                "args": (v2/*: any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
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
                        "concreteType": "PromptLabel",
                        "kind": "LinkedField",
                        "name": "labels",
                        "plural": true,
                        "selections": (v4/*: any*/),
                        "storageKey": null
                      }
                    ],
                    "type": "Prompt",
                    "abstractKey": null
                  },
                  (v3/*: any*/)
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "PromptLabelConnection",
                "kind": "LinkedField",
                "name": "promptLabels",
                "plural": false,
                "selections": [
                  {
                    "alias": null,
                    "args": null,
                    "concreteType": "PromptLabelEdge",
                    "kind": "LinkedField",
                    "name": "edges",
                    "plural": true,
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "PromptLabel",
                        "kind": "LinkedField",
                        "name": "node",
                        "plural": false,
                        "selections": (v4/*: any*/),
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "e69c3d1186012bfb2154e98ab7e2c2b6",
    "id": null,
    "metadata": {},
    "name": "PromptLabelConfigButtonSetLabelsMutation",
    "operationKind": "mutation",
    "text": "mutation PromptLabelConfigButtonSetLabelsMutation(\n  $newPromptLabelsDef: SetPromptLabelsInput!\n  $promptId: ID!\n) {\n  setPromptLabels(input: $newPromptLabelsDef) {\n    query {\n      ...PromptLabelConfigButton_labels_16seeu\n      prompt: node(id: $promptId) {\n        __typename\n        ... on Prompt {\n          ...PromptLabels\n        }\n        id\n      }\n    }\n  }\n}\n\nfragment PromptLabelConfigButton_labels_16seeu on Query {\n  prompt: node(id: $promptId) {\n    __typename\n    ... on Prompt {\n      labels {\n        id\n      }\n    }\n    id\n  }\n  promptLabels {\n    edges {\n      node {\n        id\n        name\n        color\n      }\n    }\n  }\n}\n\nfragment PromptLabels on Prompt {\n  labels {\n    name\n    color\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "db362f0fc581574c709a1949450d4e0f";

export default node;
