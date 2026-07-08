/**
 * @generated SignedSource<<2639c6d0ddc340ccdb4700c736792911>>
 * @lightSyntaxTransform
 * @nogrep
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type SessionColumnSelector_annotations$data = {
  readonly sessionAnnotationNames: ReadonlyArray<string>;
  readonly " $fragmentType": "SessionColumnSelector_annotations";
};
export type SessionColumnSelector_annotations$key = {
  readonly " $data"?: SessionColumnSelector_annotations$data;
  readonly " $fragmentSpreads": FragmentRefs<"SessionColumnSelector_annotations">;
};

const node: ReaderFragment = {
  "argumentDefinitions": [],
  "kind": "Fragment",
  "metadata": null,
  "name": "SessionColumnSelector_annotations",
  "selections": [
    {
      "alias": null,
      "args": null,
      "kind": "ScalarField",
      "name": "sessionAnnotationNames",
      "storageKey": null
    }
  ],
  "type": "Project",
  "abstractKey": null
};

(node as any).hash = "c7adb0cb468a43dbf739811ff7826066";

export default node;
