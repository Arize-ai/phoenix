/**
 * @generated SignedSource<<244b615e3fdaa90eda04f74be242ca42>>
 * @lightSyntaxTransform
 */

/* tslint:disable */
/* eslint-disable */
// @ts-nocheck

import { ReaderInlineDataFragment } from 'relay-runtime';
import { FragmentRefs } from "relay-runtime";
export type mediaContentPartFragment$data = {
  readonly file?: {
    readonly __typename: "ImageContentValue";
    readonly mediaType: string;
    readonly url: string;
  } | {
    readonly __typename: "ImageVariableValue";
    readonly variable: string;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
  readonly image?: {
    readonly __typename: "ImageContentValue";
    readonly mediaType: string;
    readonly url: string;
  } | {
    readonly __typename: "ImageVariableValue";
    readonly variable: string;
  } | {
    // This will never be '%other', but we need some
    // value in case none of the concrete values match.
    readonly __typename: "%other";
  };
  readonly " $fragmentType": "mediaContentPartFragment";
};
export type mediaContentPartFragment$key = {
  readonly " $data"?: mediaContentPartFragment$data;
  readonly " $fragmentSpreads": FragmentRefs<"mediaContentPartFragment">;
};

const node: ReaderInlineDataFragment = {
  "kind": "InlineDataFragment",
  "name": "mediaContentPartFragment"
};

(node as any).hash = "43595686b71ffb081d43e9a45a03b285";

export default node;
