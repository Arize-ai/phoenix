/**
 * @generated SignedSource<<f1d87ec6ac6c65d815428bc7abe7b5b2>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DeletePromptVersionTagInput = {
  promptVersionTagId: string;
};
export type DeletePromptVersionTagButtonMutation$variables = {
  input: DeletePromptVersionTagInput;
  promptId: string;
};
export type DeletePromptVersionTagButtonMutation$data = {
  readonly deletePromptVersionTag: {
    readonly query: {
      readonly node: {
        readonly " $fragmentSpreads": FragmentRefs<"PromptVersionTagsConfigCard_data">;
      };
    };
  };
};
export type DeletePromptVersionTagButtonMutation = {
  response: DeletePromptVersionTagButtonMutation$data;
  variables: DeletePromptVersionTagButtonMutation$variables;
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
    "name": "promptId"
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
    "variableName": "promptId"
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
    "name": "DeletePromptVersionTagButtonMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "PromptVersionTagMutationPayload",
        "kind": "LinkedField",
        "name": "deletePromptVersionTag",
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
                    "name": "PromptVersionTagsConfigCard_data"
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
    "name": "DeletePromptVersionTagButtonMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "PromptVersionTagMutationPayload",
        "kind": "LinkedField",
        "name": "deletePromptVersionTag",
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
                  (v3/*: any*/),
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
                            "name": "description",
                            "storageKey": null
                          },
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
    "cacheID": "387e2e286ff86ad049a2b4afbd189b22",
    "id": null,
    "metadata": {},
    "name": "DeletePromptVersionTagButtonMutation",
    "operationKind": "mutation",
    "text": "mutation DeletePromptVersionTagButtonMutation(\n  $input: DeletePromptVersionTagInput!\n  $promptId: ID!\n) {\n  deletePromptVersionTag(input: $input) {\n    query {\n      node(id: $promptId) {\n        __typename\n        ...PromptVersionTagsConfigCard_data\n        id\n      }\n    }\n  }\n}\n\nfragment PromptVersionTagsConfigCard_data on Prompt {\n  id\n  versionTags {\n    id\n    name\n    description\n    promptVersionId\n  }\n}\n"
  }
};
})();

(node as any).hash = "58fa5b2b6e7af186229c70b90082644a";

export default node;
