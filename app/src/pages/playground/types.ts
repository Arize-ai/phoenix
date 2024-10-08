import { spanPlaygroundPageLoaderQuery$data } from "./__generated__/spanPlaygroundPageLoaderQuery.graphql";

export interface PlaygroundInstanceProps {
  /**
   * Multiple playground instances are supported.
   * The id is used to identify the instance.
   */
  playgroundInstanceId: number;
}

/**
 * The type of a span that is fetched to pre-populate the playground.
 * This span gets fetched when navigating from a span to the playground, used for span replay.
 */
export type PlaygroundSpan = Extract<
  spanPlaygroundPageLoaderQuery$data["span"],
  { __typename: "Span" }
>;
