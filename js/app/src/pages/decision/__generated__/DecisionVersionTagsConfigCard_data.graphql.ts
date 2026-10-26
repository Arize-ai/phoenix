/**
 * @generated SignedSource<<b07c7cfddfec6928d2dc017165caab2d>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type DecisionVersionTagsConfigCard_data$data = {
  readonly id: string;
  readonly versionTags: ReadonlyArray<{
    readonly decisionVersionId: string;
    readonly description: string | null;
    readonly id: string;
    readonly name: string;
  }>;
  readonly " $fragmentType": "DecisionVersionTagsConfigCard_data";
};
export type DecisionVersionTagsConfigCard_data$key = {
  readonly " $data"?: DecisionVersionTagsConfigCard_data$data;
  readonly " $fragmentSpreads": FragmentRefs<"DecisionVersionTagsConfigCard_data">;
};

const node: ReaderFragment = (function(){
var v0 = {
  "alias": null,
  "args": null,
  "kind": "ScalarField",
  "name": "id",
  "storageKey": null
};
return {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "DecisionVersionTagsConfigCard_data",
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
          "name": "decisionVersionId",
          "storageKey": null
        }
      ],
      "storageKey": null
    }
  ],
  "type": "Decision",
  "abstractKey": null
};
})();

(node as any).hash = "363d316e29418fd7d82aa9bf63dec035";

export default node;
