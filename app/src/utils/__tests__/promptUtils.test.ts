import { describe, expect, it } from "vitest";

import {
  asFilePart,
  asFileVariablePart,
  asImagePart,
  asImageVariablePart,
  makeFilePart,
  makeFileVariablePart,
} from "@phoenix/utils/mediaParts";
import { asTextPart } from "@phoenix/utils/promptUtils";

/**
 * The shapes Relay hands back for a prompt message's content union. A member the
 * document does not select arrives carrying only its `__typename`, which is why
 * these fixtures include it — the converters have to cope with the real shape,
 * not a tidied-up one.
 */
const STORED_IMAGE = {
  __typename: "ImageContentPart",
  image: {
    __typename: "ImageContentValue",
    url: "phoenix://media/2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
    mediaType: "image/png",
  },
} as const;

const IMAGE_VARIABLE = {
  __typename: "ImageContentPart",
  image: {
    __typename: "ImageVariableValue",
    variable: "screenshot",
  },
} as const;

const STORED_FILE = {
  __typename: "FileContentPart",
  file: {
    __typename: "ImageContentValue",
    url: "phoenix://media/dbd22063825ade30f8e4d4dd1d8b7d8f6f7f5c1f0f9f4e3d2c1b0a9f8e7d6c5b",
    mediaType: "application/pdf",
  },
} as const;

const FILE_VARIABLE = {
  __typename: "FileContentPart",
  file: {
    __typename: "ImageVariableValue",
    variable: "contract",
  },
} as const;

describe("prompt content part converters", () => {
  it("recognizes a stored image and a run-time image variable as distinct parts", () => {
    // Both arrive as ImageContentPart; only the inner source tells them apart.
    // Rendering picked the wrong branch when this distinction was not made, and
    // the image variable disappeared from the prompt entirely.
    expect(asImagePart(STORED_IMAGE)).toEqual({
      image: { url: STORED_IMAGE.image.url, mediaType: "image/png" },
    });
    expect(asImageVariablePart(STORED_IMAGE)).toBeNull();

    expect(asImageVariablePart(IMAGE_VARIABLE)).toEqual({
      image: { variable: "screenshot" },
    });
    expect(asImagePart(IMAGE_VARIABLE)).toBeNull();
  });

  it("does not mistake an image part for text", () => {
    expect(asTextPart(STORED_IMAGE)).toBeNull();
    expect(asTextPart(IMAGE_VARIABLE)).toBeNull();
  });

  it("rejects a partial image source rather than rendering a broken reference", () => {
    expect(asImagePart({ image: { url: "phoenix://media/abc" } })).toBeNull();
    expect(asImagePart({ image: { mediaType: "image/png" } })).toBeNull();
    expect(asImageVariablePart({ image: {} })).toBeNull();
  });

  it("recognizes a stored document and a run-time document variable", () => {
    expect(asFilePart(STORED_FILE)).toEqual({
      file: { url: STORED_FILE.file.url, mediaType: "application/pdf" },
    });
    expect(asFileVariablePart(STORED_FILE)).toBeNull();

    expect(asFileVariablePart(FILE_VARIABLE)).toEqual({
      file: { variable: "contract" },
    });
    expect(asFilePart(FILE_VARIABLE)).toBeNull();
  });

  /**
   * Both kinds nest their source under a different key, which is the whole reason
   * a document can travel beside an image in one message without the two being
   * confused for each other.
   */
  it("keeps images and documents apart", () => {
    expect(asImagePart(STORED_FILE)).toBeNull();
    expect(asImageVariablePart(FILE_VARIABLE)).toBeNull();
    expect(asFilePart(STORED_IMAGE)).toBeNull();
    expect(asFileVariablePart(IMAGE_VARIABLE)).toBeNull();
  });

  it("rejects a partial document source", () => {
    expect(asFilePart({ file: { url: "phoenix://media/abc" } })).toBeNull();
    expect(asFilePart({ file: { mediaType: "application/pdf" } })).toBeNull();
    expect(asFileVariablePart({ file: {} })).toBeNull();
  });
});

describe("media part constructors", () => {
  it("builds the parts the playground stores on a message", () => {
    expect(makeFilePart("phoenix://media/abc", "application/pdf")).toEqual({
      file: { url: "phoenix://media/abc", mediaType: "application/pdf" },
    });
    expect(makeFileVariablePart("contract")).toEqual({
      file: { variable: "contract" },
    });
  });

  it("refuses a document with no source rather than storing a broken part", () => {
    expect(makeFilePart(null, "application/pdf")).toBeNull();
    expect(makeFilePart("phoenix://media/abc", null)).toBeNull();
    expect(makeFileVariablePart(null)).toBeNull();
    expect(makeFileVariablePart(undefined)).toBeNull();
  });
});
