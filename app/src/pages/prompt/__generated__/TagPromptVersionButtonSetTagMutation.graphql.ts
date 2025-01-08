/**
 * @generated SignedSource<<80552b8b8b3d1ebed9b3ba0019f5843e>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest, Mutation } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SetPromptVersionTagInput = {
  description?: string | null;
  name: string;
  promptVersionId: string;
};
export type TagPromptVersionButtonSetTagMutation$variables = {
  input: SetPromptVersionTagInput;
  promptVersionId: string;
};
export type TagPromptVersionButtonSetTagMutation$data = {
  readonly setPromptVersionTag: {
    readonly query: {
      readonly node: {
        readonly " $fragmentSpreads": FragmentRefs<"PromptVersionTagsList_data">;
      };
    };
  };
};
export type TagPromptVersionButtonSetTagMutation = {
  response: TagPromptVersionButtonSetTagMutation$data;
  variables: TagPromptVersionButtonSetTagMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "input"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "promptVersionId"
  }
],
v1 = [
  {
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v2 = [
  {
    "kind": "Variable",
    "name": "id",
    "variableName": "promptVersionId"
  }
],
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*: any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "TagPromptVersionButtonSetTagMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "PromptVersionTagMutationPayload",
        "kind": "LinkedField",
        "name": "setPromptVersionTag",
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
                "args": (v2/*: any*/),
                "concreteType": null,
                "kind": "LinkedField",
                "name": "node",
                "plural": false,
                "selections": [
                  {
                    "args": null,
                    "kind": "FragmentSpread",
                    "name": "PromptVersionTagsList_data"
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
    "name": "TagPromptVersionButtonSetTagMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "PromptVersionTagMutationPayload",
        "kind": "LinkedField",
        "name": "setPromptVersionTag",
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
                        "concreteType": "PromptVersionTag",
                        "kind": "LinkedField",
                        "name": "tags",
                        "plural": true,
                        "selections": [
                          (v3/*: any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "name",
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "type": "PromptVersion",
                    "abstractKey": null
                  },
                  {
                    "kind": "TypeDiscriminator",
                    "abstractKey": "__isNode"
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
    "cacheID": "5067acf4af93557023f091275bd723cd",
    "id": null,
    "metadata": {},
    "name": "TagPromptVersionButtonSetTagMutation",
    "operationKind": "mutation",
    "text": "mutation TagPromptVersionButtonSetTagMutation(\n  $input: SetPromptVersionTagInput!\n  $promptVersionId: GlobalID!\n) {\n  setPromptVersionTag(input: $input) {\n    query {\n      node(id: $promptVersionId) {\n        __typename\n        ...PromptVersionTagsList_data\n        __isNode: __typename\n        id\n      }\n    }\n  }\n}\n\nfragment PromptVersionTagsList_data on PromptVersion {\n  tags {\n    id\n    name\n  }\n}\n"
  }
};
})();

(node as any).hash = "5e4bd299988be6e68c54fc3d7aac0b50";

export default node;
