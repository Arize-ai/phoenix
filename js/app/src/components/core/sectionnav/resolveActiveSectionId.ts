/**
 * How far a section's top may sit below the line and still count as reached.
 * `scrollIntoView` and fractional zoom levels land a section's top a fraction
 * of a pixel off the line it was scrolled to.
 */
const SUB_PIXEL_TOLERANCE = 1;

export type SectionPosition = {
  id: string;
  /**
   * The section's top edge, in the same coordinate space as `lineTop`
   * (viewport coordinates from `getBoundingClientRect`)
   */
  top: number;
};

/**
 * Picks the section a scrollspy nav marks active: the last section, in
 * document order, whose top edge is at or above the line where content stops
 * being covered by the nav (the sticky bar's bottom edge, or the top of the
 * scroll container for a rail). Before any section reaches the line, the
 * first section is active. Once the container is scrolled to its end, the last
 * section is active even if it is too short to ever reach the line.
 *
 * Returns null when there are no sections.
 */
export function resolveActiveSectionId({
  sections,
  lineTop,
  isScrolledToEnd,
}: {
  /** The sections in document order */
  sections: readonly SectionPosition[];
  lineTop: number;
  isScrolledToEnd: boolean;
}): string | null {
  if (sections.length === 0) {
    return null;
  }
  if (isScrolledToEnd) {
    return sections[sections.length - 1].id;
  }
  let activeId = sections[0].id;
  for (const section of sections) {
    if (section.top <= lineTop + SUB_PIXEL_TOLERANCE) {
      activeId = section.id;
    }
  }
  return activeId;
}
