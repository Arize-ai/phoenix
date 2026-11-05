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
 * document order, whose top edge has reached `lineTop`, the line where
 * scrolled-to sections land. Before any section reaches the line, the first
 * section is active. Once the container is scrolled to its end, the last
 * section is active even if it is too short to ever reach the line.
 *
 * Returns null when there are no sections.
 */
export function resolveActiveSectionId({
  sections,
  lineTop,
  isScrolledToEnd,
  tolerance = 1,
}: {
  /** The sections in document order */
  sections: readonly SectionPosition[];
  lineTop: number;
  isScrolledToEnd: boolean;
  /**
   * How far below the line a section's top may sit and still count as
   * reached, in pixels. A scroll to a section, or a fractional zoom level,
   * can land its top a fraction of a pixel off the line.
   * @default 1
   */
  tolerance?: number;
}): string | null {
  if (sections.length === 0) {
    return null;
  }
  if (isScrolledToEnd) {
    return sections[sections.length - 1].id;
  }
  let activeId = sections[0].id;
  for (const section of sections) {
    if (section.top <= lineTop + tolerance) {
      activeId = section.id;
    }
  }
  return activeId;
}
