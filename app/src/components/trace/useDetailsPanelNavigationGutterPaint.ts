import type { RefObject } from "react";
import { useLayoutEffect } from "react";

const GUTTER_PAINT_SELECTOR = "[data-navigation-gutter-paint]";
const GUTTER_BACKGROUND_PROPERTY =
  "--details-panel-navigation-scroll-owner-background";
const GUTTER_HEIGHT_PROPERTY = "--details-panel-navigation-scroll-owner-height";
const GUTTER_LEFT_PROPERTY = "--details-panel-navigation-scroll-owner-left";
const GUTTER_TOP_PROPERTY = "--details-panel-navigation-scroll-owner-top";
const GUTTER_WIDTH_PROPERTY =
  "--details-panel-navigation-scroll-owner-gutter-width";
const SCROLLBAR_THUMB_HEIGHT_PROPERTY =
  "--details-panel-navigation-scrollbar-thumb-height";
const SCROLLBAR_THUMB_LEFT_PROPERTY =
  "--details-panel-navigation-scrollbar-thumb-left";
const SCROLLBAR_THUMB_TOP_PROPERTY =
  "--details-panel-navigation-scrollbar-thumb-top";
const SCROLLBAR_THUMB_WIDTH_PROPERTY =
  "--details-panel-navigation-scrollbar-thumb-width";
const ROW_BACKGROUND_PROPERTY =
  "--details-panel-navigation-row-bleed-background-color";
const ROW_BORDER_WIDTH_PROPERTY =
  "--details-panel-navigation-row-bleed-border-bottom-width";
const ROW_BORDER_COLOR_PROPERTY =
  "--details-panel-navigation-row-bleed-border-bottom-color";

type RgbaColor = {
  alpha: number;
  blue: number;
  green: number;
  red: number;
};

const parseRgbaColor = (color: string): RgbaColor | null => {
  const match = color
    .replace(/\s+/g, "")
    .match(/^rgba?\(([\d.]+),([\d.]+),([\d.]+)(?:,([\d.]+%?))?\)$/i);
  if (!match) {
    return null;
  }
  const alphaValue = match[4];
  const alpha = alphaValue?.endsWith("%")
    ? Number.parseFloat(alphaValue) / 100
    : Number.parseFloat(alphaValue ?? "1");
  return {
    alpha,
    blue: Number.parseFloat(match[3]),
    green: Number.parseFloat(match[2]),
    red: Number.parseFloat(match[1]),
  };
};

const isTransparent = (color: string) => {
  const normalizedColor = color.trim().toLowerCase();
  return (
    normalizedColor === "" ||
    normalizedColor === "transparent" ||
    parseRgbaColor(color)?.alpha === 0
  );
};

const resolveOpaqueColor = ({
  backdrop,
  foreground,
}: {
  backdrop: string;
  foreground: string;
}) => {
  const foregroundColor = parseRgbaColor(foreground);
  const backdropColor = parseRgbaColor(backdrop);
  if (!foregroundColor || !backdropColor || foregroundColor.alpha === 1) {
    return foreground;
  }
  const compositeChannel = (
    foregroundChannel: number,
    backdropChannel: number
  ) =>
    Math.round(
      foregroundChannel * foregroundColor.alpha +
        backdropChannel * (1 - foregroundColor.alpha)
    );
  return `rgb(${compositeChannel(
    foregroundColor.red,
    backdropColor.red
  )}, ${compositeChannel(
    foregroundColor.green,
    backdropColor.green
  )}, ${compositeChannel(foregroundColor.blue, backdropColor.blue)})`;
};

const asBackgroundLayer = ({
  color,
  height,
  top,
}: {
  color: string;
  height: number;
  top: number;
}) =>
  `linear-gradient(${color}, ${color}) 0 ${top}px / 100% ${height}px no-repeat`;

/**
 * Mirrors marked row surfaces onto the scroll owner's own background.
 *
 * Native scrollbar tracks do not composite descendant paint into a stable
 * scrollbar gutter. The scroll owner therefore paints the same row layers in
 * a pointer-transparent gutter overlay and mirrors the thumb above it. The
 * adjacent resize separator remains the sole owner of pointer gestures there.
 */
export function useDetailsPanelNavigationGutterPaint<T extends HTMLElement>({
  isEnabled = true,
  scrollOwnerRef,
}: {
  isEnabled?: boolean;
  scrollOwnerRef: RefObject<T | null>;
}) {
  useLayoutEffect(() => {
    const scrollOwner = scrollOwnerRef.current;
    if (!scrollOwner || !isEnabled) {
      return undefined;
    }

    let animationFrame: number | null = null;
    let sourceResizeObserver: ResizeObserver | null = null;
    let paintedContentHeight = scrollOwner.clientHeight;

    const getScrollbarGeometry = () => {
      const { clientHeight, clientWidth, offsetWidth, scrollTop } = scrollOwner;
      const ownerRect = scrollOwner.getBoundingClientRect();
      const scrollHeight = Math.max(clientHeight, paintedContentHeight);
      const gutterWidth = Math.max(0, offsetWidth - clientWidth);
      const maximumScrollTop = Math.max(0, scrollHeight - clientHeight);
      const thumbHeight =
        maximumScrollTop > 0
          ? Math.min(
              clientHeight,
              Math.max(20, (clientHeight * clientHeight) / scrollHeight)
            )
          : 0;
      const thumbViewportTop =
        maximumScrollTop > 0
          ? (scrollTop / maximumScrollTop) * (clientHeight - thumbHeight)
          : 0;
      const thumbWidth = Math.max(0, gutterWidth - 6);
      const thumbInset = Math.max(0, (gutterWidth - thumbWidth) / 2);
      const gutterLeft = ownerRect.right - gutterWidth;

      return {
        clientHeight,
        gutterLeft,
        gutterWidth,
        maximumScrollTop,
        ownerRect,
        thumbHeight,
        thumbInset,
        thumbTop: ownerRect.top + thumbViewportTop,
        thumbWidth,
      };
    };

    const paintScrollbarGeometry = () => {
      const {
        clientHeight,
        gutterLeft,
        gutterWidth,
        ownerRect,
        thumbHeight,
        thumbInset,
        thumbTop,
        thumbWidth,
      } = getScrollbarGeometry();

      scrollOwner.style.setProperty(
        GUTTER_HEIGHT_PROPERTY,
        `${clientHeight}px`
      );
      scrollOwner.style.setProperty(GUTTER_LEFT_PROPERTY, `${gutterLeft}px`);
      scrollOwner.style.setProperty(GUTTER_TOP_PROPERTY, `${ownerRect.top}px`);
      scrollOwner.style.setProperty(GUTTER_WIDTH_PROPERTY, `${gutterWidth}px`);
      scrollOwner.style.setProperty(
        SCROLLBAR_THUMB_HEIGHT_PROPERTY,
        `${thumbHeight}px`
      );
      scrollOwner.style.setProperty(
        SCROLLBAR_THUMB_LEFT_PROPERTY,
        `${gutterLeft + thumbInset}px`
      );
      scrollOwner.style.setProperty(
        SCROLLBAR_THUMB_TOP_PROPERTY,
        `${thumbTop}px`
      );
      scrollOwner.style.setProperty(
        SCROLLBAR_THUMB_WIDTH_PROPERTY,
        `${thumbWidth}px`
      );
    };

    const paint = () => {
      animationFrame = null;
      const ownerRect = scrollOwner.getBoundingClientRect();
      const sources = Array.from(
        scrollOwner.querySelectorAll<HTMLElement>(GUTTER_PAINT_SELECTOR)
      );
      paintedContentHeight = Math.max(
        scrollOwner.clientHeight,
        ...sources.map((source) => {
          const sourceRect = source.getBoundingClientRect();
          return sourceRect.bottom - ownerRect.top + scrollOwner.scrollTop;
        })
      );
      const defaultBackgroundColor = getComputedStyle(scrollOwner)
        .getPropertyValue("--global-background-color-default")
        .trim();
      const resolvedBackgroundColors = new Map<HTMLElement, string>();
      const layers = sources
        .map((source) => {
          const sourceRect = source.getBoundingClientRect();
          const styles = getComputedStyle(source);
          const top = sourceRect.top - ownerRect.top;
          const backgroundColor =
            styles.getPropertyValue(ROW_BACKGROUND_PROPERTY).trim() ||
            styles.backgroundColor;
          const parentSource = source.parentElement?.closest<HTMLElement>(
            GUTTER_PAINT_SELECTOR
          );
          const backdropColor =
            (parentSource && resolvedBackgroundColors.get(parentSource)) ||
            defaultBackgroundColor;
          const resolvedBackgroundColor = isTransparent(backgroundColor)
            ? backdropColor
            : resolveOpaqueColor({
                backdrop: backdropColor,
                foreground: backgroundColor,
              });
          resolvedBackgroundColors.set(source, resolvedBackgroundColor);
          const borderWidth = Number.parseFloat(
            styles.getPropertyValue(ROW_BORDER_WIDTH_PROPERTY) ||
              styles.borderBottomWidth
          );
          const borderColor =
            styles.getPropertyValue(ROW_BORDER_COLOR_PROPERTY).trim() ||
            styles.borderBottomColor;
          const sourceLayers: string[] = [];

          if (!isTransparent(backgroundColor) && sourceRect.height > 0) {
            sourceLayers.push(
              asBackgroundLayer({
                color: resolvedBackgroundColor,
                height: sourceRect.height,
                top,
              })
            );
          }
          if (
            borderWidth > 0 &&
            !isTransparent(borderColor) &&
            sourceRect.height >= borderWidth
          ) {
            sourceLayers.unshift(
              asBackgroundLayer({
                color: borderColor,
                height: borderWidth,
                top: top + sourceRect.height - borderWidth,
              })
            );
          }
          return sourceLayers;
        })
        // Later descendants paint above their ancestor surfaces.
        .reverse()
        .flat();

      if (layers.length > 0) {
        scrollOwner.style.setProperty(
          GUTTER_BACKGROUND_PROPERTY,
          layers.join(", ")
        );
      } else {
        scrollOwner.style.removeProperty(GUTTER_BACKGROUND_PROPERTY);
      }
      paintScrollbarGeometry();

      sourceResizeObserver?.disconnect();
      sourceResizeObserver = new ResizeObserver(schedulePaint);
      sourceResizeObserver.observe(scrollOwner);
      sources.forEach((source) => sourceResizeObserver?.observe(source));
    };

    const schedulePaint = () => {
      if (animationFrame == null) {
        animationFrame = requestAnimationFrame(paint);
      }
    };

    const mutationObserver = new MutationObserver(schedulePaint);
    mutationObserver.observe(scrollOwner, {
      attributeFilter: [
        "class",
        "data-focused",
        "data-has-active-descendant",
        "data-hovered",
        "data-selected",
      ],
      attributes: true,
      childList: true,
      subtree: true,
    });
    const themeRoot = scrollOwner.closest(".theme") ?? document.documentElement;
    const themeObserver = new MutationObserver(schedulePaint);
    themeObserver.observe(themeRoot, {
      attributeFilter: ["class", "data-theme"],
      attributes: true,
    });
    scrollOwner.addEventListener("pointerover", schedulePaint);
    scrollOwner.addEventListener("pointerout", schedulePaint);
    scrollOwner.addEventListener("focusin", schedulePaint);
    scrollOwner.addEventListener("focusout", schedulePaint);
    scrollOwner.addEventListener("scroll", schedulePaint, {
      passive: true,
    });
    window.addEventListener("resize", schedulePaint);
    window.addEventListener("scroll", schedulePaint, { passive: true });
    paint();

    return () => {
      if (animationFrame != null) {
        cancelAnimationFrame(animationFrame);
      }
      mutationObserver.disconnect();
      themeObserver.disconnect();
      sourceResizeObserver?.disconnect();
      scrollOwner.removeEventListener("pointerover", schedulePaint);
      scrollOwner.removeEventListener("pointerout", schedulePaint);
      scrollOwner.removeEventListener("focusin", schedulePaint);
      scrollOwner.removeEventListener("focusout", schedulePaint);
      scrollOwner.removeEventListener("scroll", schedulePaint);
      window.removeEventListener("resize", schedulePaint);
      window.removeEventListener("scroll", schedulePaint);
      scrollOwner.style.removeProperty(GUTTER_BACKGROUND_PROPERTY);
      scrollOwner.style.removeProperty(GUTTER_HEIGHT_PROPERTY);
      scrollOwner.style.removeProperty(GUTTER_LEFT_PROPERTY);
      scrollOwner.style.removeProperty(GUTTER_TOP_PROPERTY);
      scrollOwner.style.removeProperty(GUTTER_WIDTH_PROPERTY);
      scrollOwner.style.removeProperty(SCROLLBAR_THUMB_HEIGHT_PROPERTY);
      scrollOwner.style.removeProperty(SCROLLBAR_THUMB_LEFT_PROPERTY);
      scrollOwner.style.removeProperty(SCROLLBAR_THUMB_TOP_PROPERTY);
      scrollOwner.style.removeProperty(SCROLLBAR_THUMB_WIDTH_PROPERTY);
    };
  }, [isEnabled, scrollOwnerRef]);
}
