/**
 * @generated SignedSource<<677dbdd53fd7a8d5dffc22bad87c0b77>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SetPromptLabelInput = {
  promptId: string;
  promptLabelId: string;
};
export type PromptLabelConfigButtonSetLabelMutation$variables = {
  newPromptLabelDef: SetPromptLabelInput;
  promptId: string;
};
export type PromptLabelConfigButtonSetLabelMutation$data = {
  readonly setPromptLabel: {
    readonly query: {
      readonly prompt: {
        readonly " $fragmentSpreads": FragmentRefs<"PromptLabels">;
      };
      readonly " $fragmentSpreads": FragmentRefs<"PromptLabelConfigButton_labels">;
    };
  };
};
export type PromptLabelConfigButtonSetLabelMutation = {
  response: PromptLabelConfigButtonSetLabelMutation$data;
  variables: PromptLabelConfigButtonSetLabelMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "newPromptLabelDef"
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
    "variableName": "newPromptLabelDef"
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
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "color",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "PromptLabelConfigButtonSetLabelMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "PromptLabelMutationPayload",
        "kind": "LinkedField",
        "name": "setPromptLabel",
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
                "args": null,
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
    "name": "PromptLabelConfigButtonSetLabelMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "PromptLabelMutationPayload",
        "kind": "LinkedField",
        "name": "setPromptLabel",
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
                        "selections": [
                          (v3/*: any*/),
                          (v4/*: any*/),
                          (v5/*: any*/)
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
                        "selections": [
                          (v4/*: any*/),
                          (v5/*: any*/),
                          (v3/*: any*/)
                        ],
                        "storageKey": null
                      }
                    ],
                    "type": "Prompt",
                    "abstractKey": null
                  },
                  (v3/*: any*/)
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
    "cacheID": "2b373ae21b130321abbe016313e1bcc9",
    "id": null,
    "metadata": {},
    "name": "PromptLabelConfigButtonSetLabelMutation",
    "operationKind": "mutation",
    "text": "mutation PromptLabelConfigButtonSetLabelMutation(\n  $newPromptLabelDef: SetPromptLabelInput!\n  $promptId: ID!\n) {\n  setPromptLabel(input: $newPromptLabelDef) {\n    query {\n      ...PromptLabelConfigButton_labels\n      prompt: node(id: $promptId) {\n        __typename\n        ... on Prompt {\n          ...PromptLabels\n        }\n        id\n      }\n    }\n  }\n}\n\nfragment PromptLabelConfigButton_labels on Query {\n  promptLabels {\n    edges {\n      node {\n        id\n        name\n        color\n      }\n    }\n  }\n}\n\nfragment PromptLabels on Prompt {\n  labels {\n    name\n    color\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "f840cf88143b13271d2741a878857374";

export default node;
