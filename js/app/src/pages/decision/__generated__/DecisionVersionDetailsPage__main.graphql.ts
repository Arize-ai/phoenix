/**
 * @generated SignedSource<<0bbbaca19487d60714638c9a9dea3224>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DecisionVersionDetailsPage__main$data = {
  readonly decision: {
    readonly id: string;
    readonly versionTags: ReadonlyArray<{
      readonly id: string;
      readonly name: string;
    }>;
  };
  readonly id: string;
  readonly metadata: any;
  readonly previousVersion: {
    readonly " $fragmentSpreads": FragmentRefs<"DecisionDefinitionCard_version">;
  } | null;
  readonly " $fragmentSpreads": FragmentRefs<"DecisionCodeExportCard_version" | "DecisionDefinitionCard_version" | "DecisionModelConfigurationCard_version" | "DecisionVersionTagsList_data">;
  readonly " $fragmentType": "DecisionVersionDetailsPage__main";
};
export type DecisionVersionDetailsPage__main$key = {
  readonly " $data"?: DecisionVersionDetailsPage__main$data;
  readonly " $fragmentSpreads": FragmentRefs<"DecisionVersionDetailsPage__main">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
},
v1 = {
  "args": null,
  "kind": "FragmentSpread",
  "name": "DecisionDefinitionCard_version"
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "DecisionVersionDetailsPage__main",
  "selections": [
    (v0/*:: as any*/),
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "metadata",
      "storageKey": null
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "Decision",
      "kind": "LinkedField",
      "name": "decision",
      "plural": false,
      "selections": [
        (v0/*:: as any*/),
        {
          "alias": null,
          "args": null,
          "concreteType": "DecisionVersionTag",
          "kind": "LinkedField",
          "name": "versionTags",
          "plural": true,
          "selections": [
            (v0/*:: as any*/),
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
      "storageKey": null
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "DecisionVersionTagsList_data"
    },
    (v1/*:: as any*/),
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "DecisionModelConfigurationCard_version"
    },
    {
      "args": null,
      "kind": "FragmentSpread",
      "name": "DecisionCodeExportCard_version"
    },
    {
      "alias": null,
      "args": null,
      "concreteType": "DecisionVersion",
      "kind": "LinkedField",
      "name": "previousVersion",
      "plural": false,
      "selections": [
        (v1/*:: as any*/)
      ],
      "storageKey": null
    }
  ],
  "type": "DecisionVersion",
  "abstractKey": null
};
})();

(node as any).hash = "7ca6b782d4eeec0737e5d430746e6190";

export default node;
