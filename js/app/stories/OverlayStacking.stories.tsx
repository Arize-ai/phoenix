import { css } from "@emotion/react";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { DialogTrigger, SubmenuTrigger } from "react-aria-components";
import { userEvent, within } from "storybook/test";

import {
  Button,
  Dialog,
  Drawer,
  Flex,
  Menu,
  MenuContainer,
  MenuItem,
  MenuTrigger,
  Popover,
  Text,
  View,
} from "@phoenix/components";
import { Heading } from "@phoenix/components/core/content";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@phoenix/components/core/dialog";

/**
 * Educational compositions for the overlay stacking docs. Every overlay here
 * is the production component in a production-supported state — pre-opened
 * through `defaultOpen`/`isOpen` (or a real click in a play function) so the
 * full stack is visible without interaction.
 *
 * READ BEFORE COPYING: stories need a few accommodations to sit on a docs
 * page that production surfaces never need. Each one is commented at its use
 * site with a `Story-only:` prefix — everything not marked that way is the
 * production pattern.
 */
const meta: Meta = {
  title: "Core/Overlays/Stacking",
};

export default meta;

type Story = StoryObj;

// ---------------------------------------------------------------------------
// The ladder
// ---------------------------------------------------------------------------

const Z_INDEX_LADDER = [
  { token: "--global-z-index-local-base", occupants: "In-flow page content" },
  {
    token: "--global-z-index-local-raised",
    occupants: "Sticky headers, pinned table columns",
  },
  {
    token: "--global-z-index-local-overlay",
    occupants: "In-container overlays and scrims",
  },
  {
    token: "--global-z-index-local-control",
    occupants: "In-container floating controls",
  },
  { token: "--global-z-index-app-drawer", occupants: "The details drawer" },
  {
    token: "--global-z-index-app-floating",
    occupants: "Floating assistant, persistent floating popovers",
  },
  {
    token: "--global-z-index-app-floating-control",
    occupants: "Controls attached to floating surfaces",
  },
  {
    token: "--global-z-index-app-modal-backdrop",
    occupants: "Modal underlay",
  },
  { token: "--global-z-index-app-modal", occupants: "Modal dialog surfaces" },
  {
    token: "--global-z-index-app-modal-floating",
    occupants: "Floating assistant elevated over a modal",
  },
  {
    token: "--global-z-index-app-modal-floating-control",
    occupants: "Controls on modal-elevated floating surfaces",
  },
  {
    token: "--global-z-index-app-portaled-overlay",
    occupants: "Popovers, menus, selects, tooltips",
  },
  {
    token: "--global-z-index-app-notification",
    occupants: "Toasts and notifications",
  },
] as const;

/**
 * Reads a token's live computed value so the labels cannot drift from
 * GlobalStyles — the single source of truth for the ladder. Written through a
 * ref callback (the node exists in the styled document by then) rather than
 * state to keep the read out of the render cycle.
 */
function TokenValue({ token }: { token: string }) {
  return (
    <span
      ref={(node) => {
        if (node) {
          const computed = getComputedStyle(document.documentElement)
            .getPropertyValue(token)
            .trim();
          node.textContent = computed.length > 0 ? ` · ${computed}` : "";
        }
      }}
    />
  );
}

const ladderFrameCSS = css`
  position: relative;
  height: ${Z_INDEX_LADDER.length * 36 + 96}px;
  width: 100%;
  max-width: 720px;
`;

const ladderTileCSS = css`
  position: absolute;
  width: 420px;
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  border-radius: var(--global-rounding-small);
  background-color: var(--global-background-color-light);
  padding: var(--global-dimension-size-100) var(--global-dimension-size-200);
  box-shadow: 0 1px 4px rgb(0 0 0 / 0.12);

  .ladder-tile__token {
    font-family: var(--global-font-family-code);
    font-size: var(--global-font-size-xs);
  }

  .ladder-tile__occupants {
    font-size: var(--global-font-size-xs);
    color: var(--text-700);
  }
`;

function LadderTile({
  token,
  occupants,
  index,
}: {
  token: string;
  occupants: string;
  index: number;
}) {
  return (
    <div
      css={ladderTileCSS}
      style={{
        zIndex: `var(${token})`,
        left: index * 22,
        top: index * 30,
      }}
    >
      <Flex direction="row" justifyContent="space-between" gap="size-200">
        <span className="ladder-tile__token">
          {token.replace("--global-z-index-", "")}
          <TokenValue token={token} />
        </span>
        <span className="ladder-tile__occupants">{occupants}</span>
      </Flex>
    </div>
  );
}

/**
 * Renders one absolutely positioned tile per stacking token, deliberately in
 * REVERSE DOM order (highest band first). Without the tokens, DOM order would
 * paint `local-base` on top of everything; the ladder you actually see is the
 * tokens asserting themselves.
 */
const BandLadderTemplate = () => (
  <div css={ladderFrameCSS}>
    {[...Z_INDEX_LADDER].reverse().map((band, reverseIndex) => {
      const index = Z_INDEX_LADDER.length - 1 - reverseIndex;
      return (
        <LadderTile
          key={band.token}
          token={band.token}
          occupants={band.occupants}
          index={index}
        />
      );
    })}
  </div>
);

export const BandLadder: Story = {
  render: () => <BandLadderTemplate />,
  parameters: {
    themeLayout: "column",
  },
};

// ---------------------------------------------------------------------------
// Bands beat DOM order
// ---------------------------------------------------------------------------

const popoverBodyCSS = css`
  width: 260px;
`;

/**
 * The app-floating popover mounts LAST, so with equal z-index DOM order would
 * paint it on top. The portaled-overlay band wins anyway — paint order comes
 * from the band, not from mount order.
 *
 * `isNonModal` + `closeOnInteractOutside` is the production contract for a
 * consult-while-working popover: the page (here, the docs you are reading)
 * stays scrollable, and the press that dismisses the popover is consumed so
 * it cannot activate whatever sits beneath. Dismiss these and reopen them
 * from their triggers.
 */
const PopoverBandsTemplate = () => (
  <Flex direction="row" gap="size-200">
    <DialogTrigger defaultOpen>
      <Button>Portaled overlay band</Button>
      {/* Story-only: shouldFlip is disabled so the two surfaces overlap
          deterministically for the paint-order comparison. Production
          popovers normally keep flipping enabled. */}
      <Popover
        isNonModal
        closeOnInteractOutside
        placement="bottom start"
        shouldFlip={false}
      >
        <Dialog>
          <View padding="size-200" css={popoverBodyCSS}>
            <Text>
              Default band: app-portaled-overlay. This surface mounted first,
              yet it paints above its neighbor.
            </Text>
          </View>
        </Dialog>
      </Popover>
    </DialogTrigger>
    <DialogTrigger defaultOpen>
      <Button>App floating band</Button>
      <Popover
        isNonModal
        closeOnInteractOutside
        stacking="app-floating"
        placement="bottom end"
        shouldFlip={false}
      >
        <Dialog>
          <View padding="size-200" css={popoverBodyCSS}>
            <Text>
              Requested band: app-floating. Mounted last, still paints beneath.
            </Text>
          </View>
        </Dialog>
      </Popover>
    </DialogTrigger>
  </Flex>
);

export const PopoverBands: Story = {
  render: () => (
    // Story-only: pre-opened popovers portal to the body and would otherwise
    // float over the docs prose below the canvas; the padding reserves the
    // space where they land.
    <View paddingBottom="240px">
      <PopoverBandsTemplate />
    </View>
  ),
  parameters: {
    themeLayout: "column",
  },
};

// ---------------------------------------------------------------------------
// The nested clamp
// ---------------------------------------------------------------------------

/**
 * The child popover requests the app-floating band, which sits beneath the
 * parent's portaled-overlay band. The clamp resolves the child to at least
 * the parent's band, so the child cannot vanish beneath the overlay that
 * spawned it. Dismissing works here too: an outside press closes the stack
 * (each layer consumes and closes), and the triggers reopen it.
 */
const NestedBandClampTemplate = () => (
  <DialogTrigger defaultOpen>
    <Button>Parent popover</Button>
    {/* Story-only: shouldFlip disabled for a deterministic overlap. */}
    <Popover
      isNonModal
      closeOnInteractOutside
      placement="bottom start"
      shouldFlip={false}
    >
      <Dialog>
        <View padding="size-200" css={popoverBodyCSS}>
          <Flex direction="column" gap="size-100" alignItems="start">
            <Text>
              Parent surface in the default app-portaled-overlay band.
            </Text>
            <DialogTrigger defaultOpen>
              <Button size="S">Child requests app-floating</Button>
              <Popover
                isNonModal
                closeOnInteractOutside
                stacking="app-floating"
                placement="bottom start"
                shouldFlip={false}
              >
                <Dialog>
                  <View padding="size-200" css={popoverBodyCSS}>
                    <Text>
                      The clamp resolved this surface up to its parent&apos;s
                      band. Without it, this popover would paint beneath the
                      parent.
                    </Text>
                  </View>
                </Dialog>
              </Popover>
            </DialogTrigger>
          </Flex>
        </View>
      </Dialog>
    </Popover>
  </DialogTrigger>
);

export const NestedBandClamp: Story = {
  render: () => (
    // Story-only: reserves the space where the portaled surfaces land.
    <View paddingBottom="320px">
      <NestedBandClampTemplate />
    </View>
  ),
  parameters: {
    themeLayout: "column",
  },
};

// ---------------------------------------------------------------------------
// The grand tour: page → drawer → menu → submenu
// ---------------------------------------------------------------------------

const MOCK_TRACE_ROWS = [
  { id: "trace-001", title: "POST /api/chat", latency: "1.2s" },
  { id: "trace-002", title: "POST /api/chat", latency: "0.9s" },
  { id: "trace-003", title: "GET /api/documents", latency: "0.3s" },
  { id: "trace-004", title: "POST /api/embeddings", latency: "2.1s" },
  { id: "trace-005", title: "POST /api/chat", latency: "1.7s" },
] as const;

const viewportFrameCSS = css`
  /* Story-only: the transform makes this frame the containing block for the
     drawer's position: fixed, so the composition stays inside the story
     instead of covering the docs page. NEVER copy this into app code — a
     transformed ancestor silently captures every fixed-position descendant.
     Portaled overlays (the menus) still escape to the body, which is the
     point: they occupy a band above every app surface. */
  transform: translateZ(0);
  position: relative;
  overflow: hidden;
  height: 540px;
  width: 100%;
  border: var(--global-border-size-thin) solid
    var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
  background-color: var(--global-background-color-default);
`;

const mockRowCSS = css`
  display: flex;
  justify-content: space-between;
  padding: var(--global-dimension-size-100) var(--global-dimension-size-200);
  border-bottom: var(--global-border-size-thin) solid
    var(--global-border-color-default);
`;

/**
 * A framed viewport with every stratum occupied at once, already opened the
 * way a user would have opened it: page content at the local bands, the
 * details drawer at app-drawer, a menu launched from the drawer at
 * app-portaled-overlay, and its submenu beside it. The drawer genuinely
 * closes (and the page behind it reopens it), and the menus are the plain
 * production composition — non-modal by design, submenu side-placed by
 * React Aria.
 */
const DrawerMenuSubmenuTemplate = () => {
  const [isDrawerOpen, setIsDrawerOpen] = useState(true);
  return (
    <div css={viewportFrameCSS}>
      <View padding="size-200">
        <Flex direction="column" gap="size-100" alignItems="start">
          <Flex
            direction="row"
            gap="size-200"
            alignItems="center"
            justifyContent="space-between"
            width="100%"
          >
            <Heading level={2}>Traces</Heading>
            {/* The drawer is non-modal, so this button stays clickable while
                it is open — that is the modality contract on display. */}
            <Button size="S" onPress={() => setIsDrawerOpen(true)}>
              Open span details
            </Button>
          </Flex>
          <View width="100%">
            {MOCK_TRACE_ROWS.map((row) => (
              <div key={row.id} css={mockRowCSS}>
                <Text>{row.title}</Text>
                <Text color="text-700">{row.latency}</Text>
              </div>
            ))}
          </View>
        </Flex>
      </View>
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        defaultSize={380}
        minSize={320}
      >
        <Dialog>
          {({ close }) => (
            <DialogContent>
              <DialogHeader>
                <Flex direction="row" gap="size-200" alignItems="center">
                  <DialogCloseButton close={close} />
                  <DialogTitle>Span details</DialogTitle>
                </Flex>
              </DialogHeader>
              <View padding="size-200">
                <Flex direction="column" gap="size-200" alignItems="start">
                  <Text>
                    The drawer occupies the app-drawer band. It is non-modal:
                    the trace list behind it stays scrollable and clickable.
                  </Text>
                  <MenuTrigger defaultOpen>
                    <Button size="S">Annotate</Button>
                    <MenuContainer placement="bottom start">
                      <Menu aria-label="Annotate span">
                        <MenuItem id="note">Edit note</MenuItem>
                        <SubmenuTrigger>
                          <MenuItem id="dataset">Add to dataset</MenuItem>
                          {/* No placement prop: React Aria's SubmenuTrigger
                              places submenus BESIDE their trigger item, so
                              the pointer can travel to the submenu without
                              crossing sibling items (which would close it). */}
                          <MenuContainer>
                            <Menu aria-label="Datasets">
                              <MenuItem id="golden">golden-questions</MenuItem>
                              <MenuItem id="regressions">regressions</MenuItem>
                              <MenuItem id="hard-negatives">
                                hard-negatives
                              </MenuItem>
                            </Menu>
                          </MenuContainer>
                        </SubmenuTrigger>
                        <MenuItem id="copy">Copy span ID</MenuItem>
                      </Menu>
                    </MenuContainer>
                  </MenuTrigger>
                </Flex>
              </View>
            </DialogContent>
          )}
        </Dialog>
      </Drawer>
    </div>
  );
};

export const DrawerMenuSubmenu: Story = {
  render: () => <DrawerMenuSubmenuTemplate />,
  play: async () => {
    // The menu is portaled to the body, so query the document rather than
    // the story canvas. Clicking the item is the production gesture that
    // opens the submenu.
    //
    // Story-only: `findAll` + loop because the Both-themes toolbar mode
    // renders two instances of this story. The instances are independent
    // overlay trees, so opening the second submenu dismisses the first
    // instance's menu — in Both mode only the last instance shows the full
    // stack. Single-theme modes are unaffected.
    const body = within(document.body);
    const submenuTriggers = await body.findAllByRole("menuitem", {
      name: /Add to dataset/i,
    });
    for (const trigger of submenuTriggers) {
      await userEvent.click(trigger);
    }
  },
  parameters: {
    inset: false,
    width: "fill",
    themeLayout: "column",
    docs: { story: { autoplay: true } },
  },
};
