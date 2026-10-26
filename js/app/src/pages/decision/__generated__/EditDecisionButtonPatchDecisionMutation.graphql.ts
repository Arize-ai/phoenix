/**
 * @generated SignedSource<<4b0b4e65cfbad5a39540dc88b5160c41>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type PatchDecisionInput = {
  decisionId: string;
  description?: string | null;
  metadata?: any | null;
};
export type EditDecisionButtonPatchDecisionMutation$variables = {
  input: PatchDecisionInput;
};
export type EditDecisionButtonPatchDecisionMutation$data = {
  readonly patchDecision: {
    readonly " $fragmentSpreads": FragmentRefs<"DecisionIndexPage__main" | "DecisionLayout__main">;
  };
};
export type EditDecisionButtonPatchDecisionMutation = {
  response: EditDecisionButtonPatchDecisionMutation$data;
  variables: EditDecisionButtonPatchDecisionMutation$variables;
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
    "kind": "Variable",
    "name": "input",
    "variableName": "input"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v4 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "__typename",
  "storageKey": null
},
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "instructions",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v7 = [
  (v6/*:: as any*/),
  (v2/*:: as any*/)
];
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "EditDecisionButtonPatchDecisionMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "Decision",
        "kind": "LinkedField",
        "name": "patchDecision",
        "plural": false,
        "selections": [
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "DecisionIndexPage__main"
          },
          {
            "args": null,
            "kind": "FragmentSpread",
            "name": "DecisionLayout__main"
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
    "name": "EditDecisionButtonPatchDecisionMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "Decision",
        "kind": "LinkedField",
        "name": "patchDecision",
        "plural": false,
        "selections": [
          {
            "alias": "latestVersion",
            "args": null,
            "concreteType": "DecisionVersion",
            "kind": "LinkedField",
            "name": "version",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "DecisionInputDefinition",
                "kind": "LinkedField",
                "name": "inputs",
                "plural": true,
                "selections": [
                  (v2/*:: as any*/),
                  (v3/*:: as any*/),
                  {
                    "alias": null,
                    "args": null,
                    "kind": "ScalarField",
                    "name": "jsonSchema",
                    "storageKey": null
                  }
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "state",
                "plural": false,
                "selections": [
                  (v4/*:: as any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "object",
                        "storageKey": null
                      }
                    ],
                    "type": "DecisionObjectState",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "template",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "templateFormat",
                        "storageKey": null
                      }
                    ],
                    "type": "DecisionTextState",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "input",
                        "storageKey": null
                      }
                    ],
                    "type": "DecisionInputState",
                    "abstractKey": null
                  }
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": null,
                "kind": "LinkedField",
                "name": "questions",
                "plural": true,
                "selections": [
                  (v4/*:: as any*/),
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v2/*:: as any*/),
                      (v5/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "DecisionPredicateCriteria",
                        "kind": "LinkedField",
                        "name": "criteria",
                        "plural": false,
                        "selections": [
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "true",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "false",
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      }
                    ],
                    "type": "DecisionPredicateQuestion",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v2/*:: as any*/),
                      (v5/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "DecisionChoiceOption",
                        "kind": "LinkedField",
                        "name": "choices",
                        "plural": true,
                        "selections": [
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "value",
                            "storageKey": null
                          },
                          (v3/*:: as any*/)
                        ],
                        "storageKey": null
                      }
                    ],
                    "type": "DecisionChoiceQuestion",
                    "abstractKey": null
                  },
                  {
                    "kind": "InlineFragment",
                    "selections": [
                      (v2/*:: as any*/),
                      (v5/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "DecisionScaleLevel",
                        "kind": "LinkedField",
                        "name": "levels",
                        "plural": true,
                        "selections": [
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "label",
                            "storageKey": null
                          },
                          (v3/*:: as any*/)
                        ],
                        "storageKey": null
                      }
                    ],
                    "type": "DecisionScaleQuestion",
                    "abstractKey": null
                  }
                ],
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "modelName",
                "storageKey": null
              },
              {
                "alias": "decisionModelProvider",
                "args": null,
                "kind": "ScalarField",
                "name": "modelProvider",
                "storageKey": null
              },
              {
                "alias": null,
                "args": null,
                "concreteType": "GenerativeModelCustomProvider",
                "kind": "LinkedField",
                "name": "customProvider",
                "plural": false,
                "selections": (v7/*:: as any*/),
                "storageKey": null
              },
              (v6/*:: as any*/)
            ],
            "storageKey": null
          },
          (v6/*:: as any*/),
          (v3/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "metadata",
            "storageKey": null
          },
          {
            "alias": "latestVersions",
            "args": [
              {
                "kind": "Literal",
                "name": "first",
                "value": 5
              }
            ],
            "concreteType": "DecisionVersionConnection",
            "kind": "LinkedField",
            "name": "versions",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "DecisionVersionEdge",
                "kind": "LinkedField",
                "name": "edges",
                "plural": true,
                "selections": [
                  {
                    "alias": "version",
                    "args": null,
                    "concreteType": "DecisionVersion",
                    "kind": "LinkedField",
                    "name": "node",
                    "plural": false,
                    "selections": [
                      (v6/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "sequenceNumber",
                        "storageKey": null
                      },
                      (v3/*:: as any*/),
                      {
                        "alias": null,
                        "args": null,
                        "kind": "ScalarField",
                        "name": "createdAt",
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "User",
                        "kind": "LinkedField",
                        "name": "user",
                        "plural": false,
                        "selections": [
                          (v6/*:: as any*/),
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "username",
                            "storageKey": null
                          },
                          {
                            "alias": null,
                            "args": null,
                            "kind": "ScalarField",
                            "name": "profilePictureUrl",
                            "storageKey": null
                          }
                        ],
                        "storageKey": null
                      },
                      {
                        "alias": null,
                        "args": null,
                        "concreteType": "DecisionVersionTag",
                        "kind": "LinkedField",
                        "name": "tags",
                        "plural": true,
                        "selections": (v7/*:: as any*/),
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": null
              }
            ],
            "storageKey": "versions(first:5)"
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "DecisionLabel",
            "kind": "LinkedField",
            "name": "labels",
            "plural": true,
            "selections": [
              (v2/*:: as any*/),
              {
                "alias": null,
                "args": null,
                "kind": "ScalarField",
                "name": "color",
                "storageKey": null
              },
              (v6/*:: as any*/)
            ],
            "storageKey": null
          },
          (v2/*:: as any*/),
          {
            "alias": null,
            "args": null,
            "kind": "ScalarField",
            "name": "versionCount",
            "storageKey": null
          },
          {
            "alias": null,
            "args": null,
            "concreteType": "Decision",
            "kind": "LinkedField",
            "name": "sourceDecision",
            "plural": false,
            "selections": (v7/*:: as any*/),
            "storageKey": null
          }
        ],
        "storageKey": null
      }
    ]
  },
  "params": {
    "cacheID": "4a168f95ef3fa3eed55517537b020b94",
    "id": null,
    "metadata": {},
    "name": "EditDecisionButtonPatchDecisionMutation",
    "operationKind": "mutation",
    "text": "mutation EditDecisionButtonPatchDecisionMutation(\n  $input: PatchDecisionInput!\n) {\n  patchDecision(input: $input) {\n    ...DecisionIndexPage__main\n    ...DecisionLayout__main\n    id\n  }\n}\n\nfragment DecisionCodeExportCard_version on DecisionVersion {\n  id\n  inputs {\n    name\n  }\n}\n\nfragment DecisionDefinitionCard_version on DecisionVersion {\n  inputs {\n    name\n    description\n    jsonSchema\n  }\n  state {\n    __typename\n    ... on DecisionObjectState {\n      object\n    }\n    ... on DecisionTextState {\n      template\n      templateFormat\n    }\n    ... on DecisionInputState {\n      input\n    }\n  }\n  questions {\n    __typename\n    ... on DecisionPredicateQuestion {\n      name\n      instructions\n      criteria {\n        true\n        false\n      }\n    }\n    ... on DecisionChoiceQuestion {\n      name\n      instructions\n      choices {\n        value\n        description\n      }\n    }\n    ... on DecisionScaleQuestion {\n      name\n      instructions\n      levels {\n        label\n        description\n      }\n    }\n  }\n  modelName\n  decisionModelProvider: modelProvider\n  customProvider {\n    id\n    name\n  }\n}\n\nfragment DecisionIndexPage__aside on Decision {\n  id\n  description\n  metadata\n  ...DecisionLatestVersionsListFragment\n  ...EditDecisionButton_data\n  ...DecisionLabels\n}\n\nfragment DecisionIndexPage__main on Decision {\n  latestVersion: version {\n    ...DecisionDefinitionCard_version\n    ...DecisionModelConfigurationCard_version\n    ...DecisionCodeExportCard_version\n    id\n  }\n  ...DecisionIndexPage__aside\n}\n\nfragment DecisionLabels on Decision {\n  labels {\n    name\n    color\n    id\n  }\n}\n\nfragment DecisionLatestVersionsListFragment on Decision {\n  latestVersions: versions(first: 5) {\n    edges {\n      version: node {\n        id\n        sequenceNumber\n        ...DecisionVersionSummaryFragment\n      }\n    }\n  }\n}\n\nfragment DecisionLayout__main on Decision {\n  id\n  name\n  description\n  metadata\n  versionCount\n  sourceDecision {\n    id\n    name\n  }\n}\n\nfragment DecisionModelConfigurationCard_version on DecisionVersion {\n  modelName\n  decisionModelProvider: modelProvider\n  customProvider {\n    name\n    id\n  }\n}\n\nfragment DecisionVersionSummaryFragment on DecisionVersion {\n  id\n  description\n  sequenceNumber\n  createdAt\n  user {\n    id\n    username\n    profilePictureUrl\n  }\n  ...DecisionVersionTagsList_data\n}\n\nfragment DecisionVersionTagsList_data on DecisionVersion {\n  tags {\n    id\n    name\n  }\n}\n\nfragment EditDecisionButton_data on Decision {\n  id\n  description\n  metadata\n}\n"
  }
};
})();

(node as any).hash = "0e8ffbce0bbe58ada66beea8eb904e21";

export default node;
