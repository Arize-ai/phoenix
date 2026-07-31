import { css } from "@emotion/react";
import type { CSSProperties, MouseEvent, Ref } from "react";
import { createContext, useContext } from "react";
import { mergeProps } from "react-aria";
import type {
  PopoverProps as AriaPopoverProps,
  PopoverRenderProps,
} from "react-aria-components";
import { Popover as AriaPopover } from "react-aria-components";

import type { OverlayStackingBand } from "@phoenix/components/core/zIndex";
import {
  OVERLAY_STACKING_BAND_Z_INDEX,
  OVERLAY_STACKING_BANDS,
} from "@phoenix/components/core/zIndex";
import { classNames } from "@phoenix/utils/classNames";

import { popoverSurfaceCSS } from "./styles";

const popoverCSS = css`
  ${popoverSurfaceCSS}

  .react-aria-OverlayArrow svg {
    display: block;
    fill: var(--background-color);
    stroke: var(--global-border-color-default);
    stroke-width: 1px;
  }

  &[data-trigger="Select"] {
    min-width: var(--trigger-width);
  }

  &[data-placement="top"] {
    --origin: translateY(8px);

    &:has(.react-aria-OverlayArrow) {
      margin-bottom: 6px;
    }
  }

  &[data-placement="bottom"] {
    --origin: translateY(-8px);

    &:has(.react-aria-OverlayArrow) {
      margin-top: 4px;
    }

    .react-aria-OverlayArrow svg {
      transform: rotate(180deg);
    }
  }

  &[data-placement="right"] {
    --origin: translateX(-8px);

    &:has(.react-aria-OverlayArrow) {
      margin-left: 6px;
    }

    .react-aria-OverlayArrow svg {
      transform: rotate(90deg);
    }
  }

  &[data-placement="left"] {
    --origin: translateX(8px);

    &:has(.react-aria-OverlayArrow) {
      margin-right: 6px;
    }

    .react-aria-OverlayArrow svg {
      transform: rotate(-90deg);
    }
  }

  .react-aria-Dialog {
    outline: none;
  }

  & div[role="listbox"] {
    padding: var(--global-dimension-size-25);
  }
`;

type PopoverProps = AriaPopoverProps & {
  /**
   * Stacking band for the popover surface, named after the global
   * `--global-z-index-app-*` tokens. Stacking is orthogonal to modality
   * (`isNonModal`): pick the band from where the surface belongs in the app's
   * stacking order, never from its interaction contract. A nested popover is
   * clamped to at least its parent's band, so a child overlay cannot paint
   * beneath the overlay that spawned it.
   */
  stacking?: OverlayStackingBand;
};

const OverlayStackingContext = createContext<OverlayStackingBand | null>(null);

function resolveStackingBand({
  requested,
  inherited,
}: {
  requested: OverlayStackingBand;
  inherited: OverlayStackingBand | null;
}): OverlayStackingBand {
  if (
    inherited !== null &&
    OVERLAY_STACKING_BANDS.indexOf(inherited) >
      OVERLAY_STACKING_BANDS.indexOf(requested)
  ) {
    return inherited;
  }
  return requested;
}

const popoverInteractionBoundaryProps = {
  // React events bubble through the component tree even when a popover is
  // portaled. Keep clicks within the overlay from activating trigger ancestors
  // such as clickable table rows.
  onClick: (event: MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
  },
} satisfies Pick<AriaPopoverProps, "onClick">;

function Popover({
  ref,
  stacking = "app-portaled-overlay",
  children,
  ...props
}: PopoverProps & { ref?: Ref<HTMLDivElement> }) {
  const inherited = useContext(OverlayStackingContext);
  const band = resolveStackingBand({ requested: stacking, inherited });
  const zIndex = OVERLAY_STACKING_BAND_Z_INDEX[band];
  const popoverStyle = props.style;
  const style =
    typeof popoverStyle === "function"
      ? (
          renderProps: PopoverRenderProps & { defaultStyle: CSSProperties }
        ) => ({
          ...popoverStyle(renderProps),
          zIndex,
        })
      : { ...popoverStyle, zIndex };
  return (
    <AriaPopover
      {...mergeProps(props, popoverInteractionBoundaryProps)}
      ref={ref}
      style={style}
      className={classNames("popover react-aria-Popover", props.className)}
      css={popoverCSS}
    >
      {(renderProps) => (
        <OverlayStackingContext.Provider value={band}>
          {typeof children === "function" ? children(renderProps) : children}
        </OverlayStackingContext.Provider>
      )}
    </AriaPopover>
  );
}

export { Popover };
export type { PopoverProps };
