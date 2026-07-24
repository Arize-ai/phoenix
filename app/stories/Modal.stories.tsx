import { css } from "@emotion/react";
import type { Meta, StoryFn } from "@storybook/react";
import type { ReactNode } from "react";

import type { ModalProps, ViewportModalProps } from "@phoenix/components";
import {
  Button,
  Dialog,
  DialogTrigger,
  Modal,
  ModalOverlay,
  Text,
  View,
  AppFrameOverlayProvider,
  ViewportModal,
  ViewportModalOverlay,
  useAppFrameOverlay,
} from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";

const meta: Meta = {
  title: "Core/Overlays/Modal",
  component: Modal,
};

export default meta;

const Template: StoryFn<ModalProps> = (args) => (
  <DialogTrigger>
    <Button>Open Modal</Button>
    <ModalOverlay>
      <Modal {...args}>
        <Dialog>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Modal Title</DialogTitle>
              <DialogTitleExtra>
                <DialogCloseButton slot="close" />
              </DialogTitleExtra>
            </DialogHeader>
            <View padding="size-200">
              <Text>
                Lorem ipsum dolor sit amet consectetur adipisicing elit.
                Quisquam, quos.
              </Text>
            </View>
          </DialogContent>
        </Dialog>
      </Modal>
    </ModalOverlay>
  </DialogTrigger>
);

export const Default = {
  render: Template,
};

const ViewportModalTemplate: StoryFn<ViewportModalProps> = (args) => (
  <Tier1StoryFrame>
    <DialogTrigger>
      <Button>Open Viewport Modal</Button>
      <ViewportModalOverlay>
        <ViewportModal {...args}>
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Modal Title</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton slot="close" />
                </DialogTitleExtra>
              </DialogHeader>
              <View padding="size-200">
                <Text>
                  The application viewport is inert while the assistant rail
                  remains interactive. Type in the rail, then return here.
                </Text>
              </View>
            </DialogContent>
          </Dialog>
        </ViewportModal>
      </ViewportModalOverlay>
    </DialogTrigger>
  </Tier1StoryFrame>
);

export const Tier1ViewportModal = {
  render: ViewportModalTemplate,
};

const tier1FrameCSS = css`
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(18rem, 30%);
  height: min(36rem, 80vh);
  overflow: hidden;
  border: 1px solid var(--global-border-color-default);
  border-radius: var(--global-rounding-medium);
`;

const tier1ViewportCSS = css`
  position: relative;
  min-width: 0;
  overflow: hidden;
  background: var(--global-background-color-default);
`;

const tier1ContentCSS = css`
  height: 100%;
  box-sizing: border-box;
  padding: var(--global-dimension-size-200);
`;

const tier1ModalHostCSS = css`
  position: absolute;
  inset: 0;
  pointer-events: none;
`;

const tier1RailCSS = css`
  position: relative;
  z-index: 1;
  padding: var(--global-dimension-size-200);
  border-left: 1px solid var(--global-border-color-default);
  background: var(--global-background-color-primary);
`;

function Tier1StoryFrame({ children }: { children: ReactNode }) {
  return (
    <AppFrameOverlayProvider>
      <Tier1StoryFrameContent>{children}</Tier1StoryFrameContent>
    </AppFrameOverlayProvider>
  );
}

function Tier1StoryFrameContent({ children }: { children: ReactNode }) {
  const frame = useAppFrameOverlay();
  return (
    <div css={tier1FrameCSS}>
      <div css={tier1ViewportCSS} ref={frame?.setApplicationViewportElement}>
        <div
          css={tier1ContentCSS}
          inert={frame?.isViewportBlocked || undefined}
        >
          <Text>Application viewport content</Text>
          <View paddingTop="size-200">{children}</View>
        </div>
        <div
          inert={frame?.isViewportBlocked || undefined}
          ref={frame?.setDrawerHostElement}
        />
        <div css={tier1ModalHostCSS} ref={frame?.setViewportModalHostElement} />
      </div>
      <aside aria-label="Assistant" css={tier1RailCSS} role="complementary">
        <label>
          <Text>Collaborative rail</Text>
          <input placeholder="Type while the form is open" />
        </label>
      </aside>
    </div>
  );
}

const NoOverlayTemplate: StoryFn<ModalProps> = (args) => (
  <DialogTrigger>
    <Button>Open Normal Modal</Button>
    <Modal {...args}>
      <Dialog>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modal Title</DialogTitle>
            <DialogTitleExtra>
              <DialogCloseButton slot="close" />
            </DialogTitleExtra>
          </DialogHeader>
          <View padding="size-200">
            <Text>
              Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam,
              quos.
            </Text>
          </View>
        </DialogContent>
      </Dialog>
    </Modal>
  </DialogTrigger>
);

export const NoOverlay = {
  render: NoOverlayTemplate,
};
