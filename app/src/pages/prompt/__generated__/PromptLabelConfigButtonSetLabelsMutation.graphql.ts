/**
 * @generated SignedSource<<f9d6a5c79eaa5e19f46c73476279656d>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptLabelConfigButtonSetLabelsMutation$variables = {
  promptId: string;
  promptLabelIds: ReadonlyArray<string>;
};
export type PromptLabelConfigButtonSetLabelsMutation$data = {
  readonly setPromptLabels: {
    readonly query: {
      readonly node: {
        readonly " $fragmentSpreads": FragmentRefs<"PromptLabelConfigButton_promptLabels">;
      };
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
    "name": "promptId"
  },
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "promptLabelIds"
  }
],
v1 = [
  {
    "fields": [
      {
        "kind": "Variable",
        "name": "promptId",
        "variableName": "promptId"
      },
      {
        "kind": "Variable",
        "name": "promptLabelIds",
        "variableName": "promptLabelIds"
      }
    ],
    "kind": "ObjectValue",
    "name": "input"
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
    "name": "PromptLabelConfigButtonSetLabelsMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*: any*/),
        "concreteType": "PromptLabelAssociationMutationPayload",
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
                "alias": null,
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
                        "name": "PromptLabelConfigButton_promptLabels"
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
        "concreteType": "PromptLabelAssociationMutationPayload",
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
                        "concreteType": "PromptLabel",
                        "kind": "LinkedField",
                        "name": "labels",
                        "plural": true,
                        "selections": [
                          (v3/*: any*/)
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
    "cacheID": "0dee2c7f46c3544f59a4f7d1492703a9",
    "id": null,
    "metadata": {},
    "name": "PromptLabelConfigButtonSetLabelsMutation",
    "operationKind": "mutation",
    "text": "mutation PromptLabelConfigButtonSetLabelsMutation(\n  $promptId: ID!\n  $promptLabelIds: [ID!]!\n) {\n  setPromptLabels(input: {promptId: $promptId, promptLabelIds: $promptLabelIds}) {\n    query {\n      node(id: $promptId) {\n        __typename\n        ... on Prompt {\n          ...PromptLabelConfigButton_promptLabels\n        }\n        id\n      }\n    }\n  }\n}\n\nfragment PromptLabelConfigButton_promptLabels on Prompt {\n  id\n  labels {\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "eb92a569b031b4a9bfbac8ae446cd13a";

export default node;
