/**
 * @generated SignedSource<<57072fe9e315ead664ab2e94b2d2761b>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PromptLabelConfigButtonUnsetLabelsMutation$variables = {
  promptId: string;
  promptLabelIds: ReadonlyArray<string>;
};
export type PromptLabelConfigButtonUnsetLabelsMutation$data = {
  readonly unsetPromptLabels: {
    readonly query: {
      readonly node: {
        readonly " $fragmentSpreads": FragmentRefs<"PromptLabelConfigButton_promptLabels">;
      };
    };
  };
};
export type PromptLabelConfigButtonUnsetLabelsMutation = {
  response: PromptLabelConfigButtonUnsetLabelsMutation$data;
  variables: PromptLabelConfigButtonUnsetLabelsMutation$variables;
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "PromptLabelConfigButtonUnsetLabelsMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "PromptLabelAssociationMutationPayload",
        "kind": "LinkedField",
        "name": "unsetPromptLabels",
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
                "args": (v2/*:: as any*/),
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
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Operation",
    "name": "PromptLabelConfigButtonUnsetLabelsMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "PromptLabelAssociationMutationPayload",
        "kind": "LinkedField",
        "name": "unsetPromptLabels",
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
                "args": (v2/*:: as any*/),
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
                  (v3/*:: as any*/),
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
                          (v3/*:: as any*/)
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
    "cacheID": "61c8ef9cb3cf1be548144a198841df1f",
    "id": null,
    "metadata": {},
    "name": "PromptLabelConfigButtonUnsetLabelsMutation",
    "operationKind": "mutation",
    "text": "mutation PromptLabelConfigButtonUnsetLabelsMutation(\n  $promptId: ID!\n  $promptLabelIds: [ID!]!\n) {\n  unsetPromptLabels(input: {promptId: $promptId, promptLabelIds: $promptLabelIds}) {\n    query {\n      node(id: $promptId) {\n        __typename\n        ... on Prompt {\n          ...PromptLabelConfigButton_promptLabels\n        }\n        id\n      }\n    }\n  }\n}\n\nfragment PromptLabelConfigButton_promptLabels on Prompt {\n  id\n  labels {\n    id\n  }\n}\n"
  }
};
})();

(node as any).hash = "e62fb77edf0bb2eccfbb2af2c85d6f82";

export default node;
