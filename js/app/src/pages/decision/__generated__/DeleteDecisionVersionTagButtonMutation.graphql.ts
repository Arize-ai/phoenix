/**
 * @generated SignedSource<<b1e3a9a443f8a8d420e77b143ec22518>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ConcreteRequest } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DeleteDecisionVersionTagButtonMutation$variables = {
  decisionVersionTagId: string;
};
export type DeleteDecisionVersionTagButtonMutation$data = {
  readonly deleteDecisionVersionTag: {
    readonly decision: {
      readonly versionTags: ReadonlyArray<{
        readonly id: string;
        readonly name: string;
      }>;
      readonly " $fragmentSpreads": FragmentRefs<"DecisionLatestVersionsListFragment" | "DecisionVersionTagsConfigCard_data" | "DecisionVersionsList__main">;
    };
  };
};
export type DeleteDecisionVersionTagButtonMutation = {
  response: DeleteDecisionVersionTagButtonMutation$data;
  variables: DeleteDecisionVersionTagButtonMutation$variables;
};

const node: ConcreteRequest = (function(){
var v0 = [
  {
    "defaultValue": null,
    "kind": "LocalArgument",
    "name": "decisionVersionTagId"
  }
],
v1 = [
  {
    "fields": [
      {
        "kind": "Variable",
        "name": "decisionVersionTagId",
        "variableName": "decisionVersionTagId"
      }
    ],
    "kind": "ObjectValue",
    "name": "input"
  }
],
v2 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v3 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "name",
  "storageKey": null
},
v4 = [
  (v2/*:: as any*/),
  (v3/*:: as any*/)
],
v5 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "description",
  "storageKey": null
},
v6 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "sequenceNumber",
  "storageKey": null
},
v7 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "createdAt",
  "storageKey": null
},
v8 = {
  "alias": null,
  "args": null,
  "concreteType": "User",
  "kind": "LinkedField",
  "name": "user",
  "plural": false,
  "selections": [
    (v2/*:: as any*/),
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
v9 = {
  "alias": null,
  "args": null,
  "concreteType": "DecisionVersionTag",
  "kind": "LinkedField",
  "name": "tags",
  "plural": true,
  "selections": (v4/*:: as any*/),
  "storageKey": null
};
return {
  "fragment": {
    "argumentDefinitions": (v0/*:: as any*/),
    "kind": "Fragment",
    "metadata": null,
    "name": "DeleteDecisionVersionTagButtonMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "DecisionVersionTagMutationPayload",
        "kind": "LinkedField",
        "name": "deleteDecisionVersionTag",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Decision",
            "kind": "LinkedField",
            "name": "decision",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "DecisionVersionTag",
                "kind": "LinkedField",
                "name": "versionTags",
                "plural": true,
                "selections": (v4/*:: as any*/),
                "storageKey": null
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "DecisionVersionTagsConfigCard_data"
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "DecisionVersionsList__main"
              },
              {
                "args": null,
                "kind": "FragmentSpread",
                "name": "DecisionLatestVersionsListFragment"
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
    "name": "DeleteDecisionVersionTagButtonMutation",
    "selections": [
      {
        "alias": null,
        "args": (v1/*:: as any*/),
        "concreteType": "DecisionVersionTagMutationPayload",
        "kind": "LinkedField",
        "name": "deleteDecisionVersionTag",
        "plural": false,
        "selections": [
          {
            "alias": null,
            "args": null,
            "concreteType": "Decision",
            "kind": "LinkedField",
            "name": "decision",
            "plural": false,
            "selections": [
              {
                "alias": null,
                "args": null,
                "concreteType": "DecisionVersionTag",
                "kind": "LinkedField",
                "name": "versionTags",
                "plural": true,
                "selections": [
                  (v2/*:: as any*/),
                  (v3/*:: as any*/),
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
              },
              (v2/*:: as any*/),
              {
                "alias": null,
                "args": [
                  {
                    "kind": "Literal",
                    "name": "first",
                    "value": 100
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
                          (v2/*:: as any*/),
                          (v5/*:: as any*/),
                          (v6/*:: as any*/),
                          (v7/*:: as any*/),
                          (v8/*:: as any*/),
                          (v9/*:: as any*/)
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": "versions(first:100)"
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
                          (v2/*:: as any*/),
                          (v6/*:: as any*/),
                          (v5/*:: as any*/),
                          (v7/*:: as any*/),
                          (v8/*:: as any*/),
                          (v9/*:: as any*/)
                        ],
                        "storageKey": null
                      }
                    ],
                    "storageKey": null
                  }
                ],
                "storageKey": "versions(first:5)"
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
    "cacheID": "5a90272b267128813b6aa39f7aace911",
    "id": null,
    "metadata": {},
    "name": "DeleteDecisionVersionTagButtonMutation",
    "operationKind": "mutation",
    "text": "mutation DeleteDecisionVersionTagButtonMutation(\n  $decisionVersionTagId: ID!\n) {\n  deleteDecisionVersionTag(input: {decisionVersionTagId: $decisionVersionTagId}) {\n    decision {\n      versionTags {\n        id\n        name\n      }\n      ...DecisionVersionTagsConfigCard_data\n      ...DecisionVersionsList__main\n      ...DecisionLatestVersionsListFragment\n      id\n    }\n  }\n}\n\nfragment DecisionLatestVersionsListFragment on Decision {\n  latestVersions: versions(first: 5) {\n    edges {\n      version: node {\n        id\n        sequenceNumber\n        ...DecisionVersionSummaryFragment\n      }\n    }\n  }\n}\n\nfragment DecisionVersionSummaryFragment on DecisionVersion {\n  id\n  description\n  sequenceNumber\n  createdAt\n  user {\n    id\n    username\n    profilePictureUrl\n  }\n  ...DecisionVersionTagsList_data\n}\n\nfragment DecisionVersionTagsConfigCard_data on Decision {\n  id\n  versionTags {\n    id\n    name\n    description\n    decisionVersionId\n  }\n}\n\nfragment DecisionVersionTagsList_data on DecisionVersion {\n  tags {\n    id\n    name\n  }\n}\n\nfragment DecisionVersionsList__main on Decision {\n  versions(first: 100) {\n    edges {\n      version: node {\n        id\n        ...DecisionVersionSummaryFragment\n      }\n    }\n  }\n}\n"
  }
};
})();

(node as any).hash = "403229e19f7ed67402e2add5f2bf0bcb";

export default node;
