/**
 * The thumbnail contract shared by the preview, the generator, the linter, and
 * the `Overview` pages.
 *
 * A component opts into a thumbnail by exporting a story named `Thumbnail`.
 * The preview renders that story inside a fixed frame of exactly
 * `THUMBNAIL_SIZE`, and `pnpm storybook:thumbnails` screenshots the frame at
 * `THUMBNAIL_SCALE` in each docs theme, writing
 * `<Name>.thumbnail.<light|dark>.png` beside the story file. The story is the
 * source of truth; the images are regenerated from it, never edited.
 *
 * Overlays the story opens render inside the frame, not against the window,
 * and a component too large for the frame at 1:1 (a drawer, a modal) can set
 * `parameters: { thumbnail: { scale } }`. The frame is then laid out
 * `1 / scale` times larger in real CSS pixels and photographed at
 * `THUMBNAIL_SCALE * scale`, so the image size never changes and nothing in
 * the story is measured through a transform.
 *
 * The story carries `tags: ["!dev", "!autodocs"]`: it exists to be
 * photographed, not browsed, so it stays out of the sidebar and the docs page
 * while remaining in the index where the generator finds it.
 *
 * @see js/app/.storybook/preview.tsx for the frame
 * @see js/app/scripts/generate-story-thumbnails.ts for the generator
 * @see js/app/stories/utils/SubjectOverview.tsx for where the images appear
 */

/** The exact export and display name that marks a thumbnail story. */
export const THUMBNAIL_STORY_NAME = "Thumbnail";

/** The frame, in CSS pixels. 16:10, the Overview card's aspect ratio. */
export const THUMBNAIL_SIZE = { width: 320, height: 200 } as const;

/** A `Thumbnail` story's `parameters.thumbnail`. */
export type ThumbnailParameters = {
  /**
   * Drawn size relative to 1:1. Below 1 fits a large component; above 1
   * enlarges a small one. Defaults to 1.
   */
  scale?: number;
  /**
   * An ARIA role, such as `"link"`: the generator moves a real pointer over
   * the frame's first element with it before shooting. For hover-only
   * surfaces with no open prop. A `play` function cannot stand in: React
   * Aria ignores the synthetic hover it dispatches, and opening by keyboard
   * focus would photograph the focus ring too.
   */
  hover?: string;
};

/** Carries `ThumbnailParameters.scale` from the frame to the generator. */
export const THUMBNAIL_SCALE_ATTRIBUTE = "data-thumbnail-scale";

/** Carries `ThumbnailParameters.hover` from the frame to the generator. */
export const THUMBNAIL_HOVER_ATTRIBUTE = "data-thumbnail-hover";

/** Device pixels per CSS pixel in the written images (640×400). */
export const THUMBNAIL_SCALE = 2;

/** Marks the frame element the generator photographs. */
export const THUMBNAIL_FRAME_TEST_ID = "thumbnail-frame";

export const THUMBNAIL_THEMES = ["light", "dark"] as const;
export type ThumbnailTheme = (typeof THUMBNAIL_THEMES)[number];

/** A thumbnail story's tags must include both, so it is never browsed. */
export const THUMBNAIL_REQUIRED_TAGS = ["!dev", "!autodocs"] as const;

/** The exact pixel size of every written image: `THUMBNAIL_SIZE` × `THUMBNAIL_SCALE`. */
export function thumbnailPixelSize() {
  return {
    width: THUMBNAIL_SIZE.width * THUMBNAIL_SCALE,
    height: THUMBNAIL_SIZE.height * THUMBNAIL_SCALE,
  };
}

/**
 * A PNG's pixel size, read from its IHDR chunk: the width and height are the
 * big-endian 32-bit integers at bytes 16 and 20 of every PNG.
 */
export function pngSize(png: Uint8Array): { width: number; height: number } {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}
