import { css } from "@emotion/react";
import type { PropsWithChildren, ReactNode } from "react";

import { Text, View } from "@phoenix/components";

const identityRowCSS = css`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: var(--global-dimension-size-100);
  min-width: 0;

  &
    > :not(
      .detail-header__title,
      .detail-header-skeleton__title,
      .span-header__name,
      .span-header-skeleton__name
    ) {
    flex: none;
  }
  .span-status-indicator + .detail-header__title {
    transform: translateY(calc(-1 * var(--global-dimension-size-10)));
  }
  .span-header__status-message {
    flex: 0 1 auto;
    min-width: 0;
  }
  .detail-header__actions {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: var(--global-dimension-size-100);
    margin-left: auto;
  }
`;

const titleCSS = css`
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const metaRowCSS = css`
  display: flex;
  flex-direction: row;
  align-items: center;
  flex-wrap: nowrap;
  gap: var(--global-dimension-size-100);
  min-width: 0;
  min-height: var(--global-line-height-s);
  overflow: hidden;

  .detail-header__meta-item {
    display: inline-flex;
    align-items: center;
    flex: none;
  }
  .detail-header__meta-item + .detail-header__meta-item::before {
    content: "·";
    color: var(--global-text-color-300);
    margin-right: var(--global-dimension-size-100);
  }
`;

const annotationRowCSS = css`
  margin-top: var(--global-dimension-size-50);
`;

/** Shared frame for loaded, preview, and skeleton detail headers. */
export function DetailHeader({
  annotationBar,
  children,
}: PropsWithChildren<{ annotationBar?: ReactNode }>) {
  return (
    <View
      data-detail-header
      paddingTop="size-100"
      paddingBottom="size-100"
      paddingStart="size-150"
      paddingEnd="size-200"
      flex="none"
      borderBottomWidth="thin"
      borderBottomColor="default"
    >
      {children}
      {annotationBar ? (
        <div className="detail-header__annotations" css={annotationRowCSS}>
          {annotationBar}
        </div>
      ) : null}
    </View>
  );
}

export function DetailHeaderIdentityRow({ children }: PropsWithChildren) {
  return (
    <div
      className="detail-header__identity span-header__identity"
      css={identityRowCSS}
    >
      {children}
    </div>
  );
}

export function DetailHeaderTitle({ title }: { title: string }) {
  return (
    <Text
      size="L"
      weight="heavy"
      className="detail-header__title span-header__name"
      title={title}
      css={titleCSS}
    >
      {title}
    </Text>
  );
}

export function DetailHeaderMetaRow({
  children,
  trailing,
}: PropsWithChildren<{ trailing?: ReactNode }>) {
  return (
    <div className="detail-header__meta span-header__meta" css={metaRowCSS}>
      {children}
      {trailing ? (
        <span
          className="detail-header__meta-trailing"
          css={css`
            display: inline-flex;
            flex: 1 1 auto;
            align-items: center;
            justify-content: flex-end;
            min-width: 0;
            margin-left: auto;
            overflow: hidden;
          `}
        >
          {trailing}
        </span>
      ) : null}
    </div>
  );
}

export function DetailHeaderMetaItem({ children }: PropsWithChildren) {
  return (
    <span className="detail-header__meta-item span-header__meta-item">
      {children}
    </span>
  );
}
