import { describe, expect, it } from "vitest";

import type { mediaContentPartFragment$key } from "@phoenix/utils/__generated__/mediaContentPartFragment.graphql";
import {
  flattenMediaContent,
  readMediaContentPart,
} from "@phoenix/utils/mediaContentPartFragment";

/**
 * The shape Relay actually hands back for a part in a document spreading an `@inline`
 * fragment: the fragment's data sits under `__fragments`, keyed by fragment name, and
 * is *not* flattened onto the part.
 *
 * This is the whole point of the test. An earlier version of this code read
 * `part.image` directly, which is empty for every part in that shape, so media
 * vanished from the prompt page and from anything loading a prompt into the
 * playground. Nothing caught it: the selection was present so the selection guard
 * passed, the types compiled because Relay's union ends in a `"%other"` arm, and every
 * other test fed plain objects — the one shape that still worked.
 */
function relayPart(
  fragmentData: Record<string, unknown>,
  rest: object = {}
): mediaContentPartFragment$key {
  // The compile-time key is an opaque brand; the runtime shape is what `readInlineData`
  // reads, so the fixture supplies that and asserts the brand.
  return {
    ...rest,
    __fragments: { mediaContentPartFragment: fragmentData },
    __id: "client:test:content:0",
  } as unknown as mediaContentPartFragment$key;
}

describe("reading media off a Relay part", () => {
  it("reads a stored image", () => {
    const part = relayPart(
      {
        image: {
          __typename: "ImageContentValue",
          url: "phoenix://media/abc",
          mediaType: "image/png",
        },
      },
      { __typename: "ImageContentPart" }
    );
    expect(readMediaContentPart(part)).toEqual({
      image: { url: "phoenix://media/abc", mediaType: "image/png" },
    });
  });

  it("reads an image variable", () => {
    const part = relayPart(
      { image: { __typename: "ImageVariableValue", variable: "screenshot" } },
      { __typename: "ImageContentPart" }
    );
    expect(readMediaContentPart(part)).toEqual({
      image: { variable: "screenshot" },
    });
  });

  it("reads a stored document and a document variable", () => {
    expect(
      readMediaContentPart(
        relayPart(
          {
            file: {
              __typename: "ImageContentValue",
              url: "phoenix://media/def",
              mediaType: "application/pdf",
            },
          },
          { __typename: "FileContentPart" }
        )
      )
    ).toEqual({
      file: { url: "phoenix://media/def", mediaType: "application/pdf" },
    });

    expect(
      readMediaContentPart(
        relayPart(
          { file: { __typename: "ImageVariableValue", variable: "contract" } },
          { __typename: "FileContentPart" }
        )
      )
    ).toEqual({ file: { variable: "contract" } });
  });

  it("returns null for a part carrying no media", () => {
    const textPart = relayPart(
      {},
      {
        __typename: "TextContentPart",
        text: { text: "describe this" },
      }
    );
    expect(readMediaContentPart(textPart)).toBeNull();
  });

  /**
   * The flattening is what lets the structural converters — which also accept
   * templates built by hand — keep one shape.
   */
  it("flattens a whole content array so the converters can discriminate it", () => {
    const content = [
      relayPart(
        {},
        { __typename: "TextContentPart", text: { text: "compare" } }
      ),
      relayPart(
        { image: { __typename: "ImageVariableValue", variable: "photo" } },
        { __typename: "ImageContentPart" }
      ),
      relayPart(
        { file: { __typename: "ImageVariableValue", variable: "contract" } },
        { __typename: "FileContentPart" }
      ),
    ];

    const flattened = flattenMediaContent(content) as Record<string, unknown>[];

    expect(flattened[0]).toMatchObject({ text: { text: "compare" } });
    // The media fields are now where a structural reader expects them.
    expect(flattened[1]).toMatchObject({ image: { variable: "photo" } });
    expect(flattened[2]).toMatchObject({ file: { variable: "contract" } });
  });
});
