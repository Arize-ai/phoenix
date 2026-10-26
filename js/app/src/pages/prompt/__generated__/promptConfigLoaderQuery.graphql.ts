/**
 * @generated SignedSource<<0cc3f98573a718683926625697d21c8d>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type promptConfigLoaderQuery$variables = {
  id: string;
};
export type promptConfigLoaderQuery$data = {
  readonly prompt: {
    readonly __typename: "Decision";
    readonly " $fragmentSpreads": FragmentRefs<"DecisionVersionTagsConfigCard_data">;
  } | {
    readonly __typename: "Prompt";
    readonly " $fragmentSpreads": FragmentRefs<"PromptVersionTagsConfigCard_data">;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
};
export type promptConfigLoaderQuery = {
  response: promptConfigLoaderQuery$data;
  variables: promptConfigLoaderQuery$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "id"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "id"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
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
  "name": "description",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "promptConfigLoaderQuery",
    "selections": [
      {
        "alias": "prompt",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "PromptVersionTagsConfigCard_data"
              }
            ],
            "type": "Prompt",
            "abstractKey": null
          },
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "DecisionVersionTagsConfigCard_data"
              }
            ],
            "type": "Decision",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ],
    "type": "Query",
    "abstractKey": null
  },
  "kind": "Request",
  "operation": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "promptConfigLoaderQuery",
    "selections": [
      {
        "alias": "prompt",
        "args": (v1/*:: as any*/),
        "concreteType": null,
        "kind": "LinkedField",
        "name": "node",
        "plural": false,
        "selections": [
          (v2/*:: as any*/),
          (v3/*:: as any*/),
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "PromptVersionTag",
                "kind": "LinkedField",
                "name": "versionTags",
                "plural": true,
                "selections": [
                  (v3/*:: as any*/),
                  (v4/*:: as any*/),
                  (v5/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "promptVersionId",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "Prompt",
            "abstractKey": null
          },
          {
            "kind": "InlineFragment",
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "DecisionVersionTag",
                "kind": "LinkedField",
                "name": "versionTags",
                "plural": true,
                "selections": [
                  (v3/*:: as any*/),
                  (v4/*:: as any*/),
                  (v5/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "decisionVersionId",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "type": "Decision",
            "abstractKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "c3ce8da5f8344e9ef6f61451ac9775d8",
    "id": null,
    "metadata": {},
    "name": "promptConfigLoaderQuery",
    "operationKind": "query",
    "text": "query promptConfigLoaderQuery(\n  $id: ID!\n) {\n  prompt: node(id: $id) {\n    __typename\n    ... on Prompt {\n      ...PromptVersionTagsConfigCard_data\n    }\n    ... on Decision {\n      ...DecisionVersionTagsConfigCard_data\n    }\n    id\n  }\n}\n\nfragment DecisionVersionTagsConfigCard_data on Decision {\n  id\n  versionTags {\n    id\n    name\n    description\n    decisionVersionId\n  }\n}\n\nfragment PromptVersionTagsConfigCard_data on Prompt {\n  id\n  versionTags {\n    id\n    name\n    description\n    promptVersionId\n  }\n}\n"
  }
};
})();

(node as any).hash = "1d8f66a3859dfeee0e985bfbcf19dd20";

export default node;
