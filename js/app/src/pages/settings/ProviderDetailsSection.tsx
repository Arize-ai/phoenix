import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { useId } from "react";

import { Heading, StatusIndicator, Text, Token } from "@phoenix/components";
import type { SizeValue } from "@phoenix/components/core/overlay";
import { assertUnreachable } from "@phoenix/typeUtils";

/**
 * Provider details are a short list of settings, so their drawers open far
 * narrower than the dense trace and session drawers the defaults suit.
 */
export const PROVIDER_DETAILS_DRAWER_DEFAULT_SIZE: SizeValue = 560;
export const PROVIDER_DETAILS_DRAWER_MIN_SIZE: SizeValue = 400;

export type ProviderDetailValue =
  | { kind: "text"; text: string }
  | { kind: "code"; text: string }
  | { kind: "status"; isOk: boolean; label: string; detail?: string }
  | { kind: "tokens"; items: readonly string[]; emptyText: string };

export type ProviderDetail = {
  label: string;
  value: ProviderDetailValue;
};

const providerDetailsSectionCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  .provider-details-section__list {
    display: grid;
    grid-template-columns: 9rem minmax(0, 1fr);
    column-gap: var(--global-dimension-size-200);
    row-gap: var(--global-dimension-size-125);
    margin: 0;
  }
  .provider-details-section__item {
    display: contents;
  }
  .provider-details-section__term {
    color: var(--global-text-color-700);
    font-size: var(--global-font-size-s);
    line-height: var(--global-line-height-s);
  }
  .provider-details-section__description {
    margin: 0;
    min-width: 0;
    overflow-wrap: anywhere;
    font-size: var(--global-font-size-s);
    line-height: var(--global-line-height-s);
  }
  .provider-details-section__code {
    font-family: var(--global-font-family-mono);
  }
  .provider-details-section__tokens {
    display: flex;
    flex-wrap: wrap;
    gap: var(--global-dimension-size-50);
  }
`;

function ProviderDetailValueView({ value }: { value: ProviderDetailValue }) {
  switch (value.kind) {
    case "text":
      return <>{value.text}</>;
    case "code":
      return (
        <span className="provider-details-section__code">{value.text}</span>
      );
    case "status":
      return (
        <StatusIndicator
          category={value.isOk ? "succeeded" : "unset"}
          label={value.label}
          detail={value.detail}
        />
      );
    case "tokens":
      return value.items.length > 0 ? (
        <span className="provider-details-section__tokens">
          {value.items.map((item) => (
            <Token key={item} maxWidth="100%" title={item}>
              {item}
            </Token>
          ))}
        </span>
      ) : (
        <Text size="S" color="text-700">
          {value.emptyText}
        </Text>
      );
    default:
      return assertUnreachable(value);
  }
}

type ProviderListItem = {
  name: string;
  /** Subdued text after the name, e.g. "optional". */
  note?: string;
};

const providerListSectionCSS = css`
  display: flex;
  flex-direction: column;
  gap: var(--global-dimension-size-100);
  .provider-list-section__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-75);
    font-size: var(--global-font-size-s);
    line-height: var(--global-line-height-s);
  }
  .provider-list-section__name {
    overflow-wrap: anywhere;
  }
  .provider-list-section__chips {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: var(--global-dimension-size-75);
  }
  .provider-list-section__chip {
    font-family: var(--global-font-family-mono);
    font-size: var(--global-font-size-xs);
    line-height: var(--global-line-height-xs);
    padding: var(--global-dimension-size-25) var(--global-dimension-size-75);
    border-radius: var(--global-rounding-small);
    background-color: var(--global-inline-code-background-color);
    white-space: nowrap;
  }
  &[data-monospace="true"] .provider-list-section__name {
    font-family: var(--global-font-family-mono);
  }
  .provider-list-section__note {
    color: var(--global-text-color-700);
    margin-left: var(--global-dimension-size-100);
  }
`;

/**
 * A titled list of names, such as a provider's models or credential
 * environment variables, with an optional status line above it. Long lists
 * such as model names read better as wrapping chips.
 */
export function ProviderListSection({
  title,
  status,
  items,
  emptyText,
  isMonospace = false,
  isInline = false,
}: {
  title: string;
  status?: ReactNode;
  items: readonly ProviderListItem[];
  emptyText: string;
  isMonospace?: boolean;
  /** Show the names as wrapping chips instead of one per line. */
  isInline?: boolean;
}) {
  const headingId = useId();
  return (
    <section
      className="provider-list-section"
      css={providerListSectionCSS}
      aria-labelledby={headingId}
      data-monospace={isMonospace}
    >
      <Heading level={3} id={headingId} weight="heavy">
        {title}
      </Heading>
      {status}
      {items.length > 0 && isInline ? (
        <ul className="provider-list-section__chips">
          {items.map((item) => (
            <li key={item.name} className="provider-list-section__chip">
              {item.name}
            </li>
          ))}
        </ul>
      ) : items.length > 0 ? (
        <ul className="provider-list-section__list">
          {items.map((item) => (
            <li key={item.name}>
              <span className="provider-list-section__name">{item.name}</span>
              {item.note ? (
                <span className="provider-list-section__note">{item.note}</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <Text size="S" color="text-700">
          {emptyText}
        </Text>
      )}
    </section>
  );
}

/**
 * A titled list of a provider's settings, as label and value pairs.
 */
export function ProviderDetailsSection({
  title,
  details,
}: {
  title: string;
  details: readonly ProviderDetail[];
}) {
  const headingId = useId();
  return (
    <section
      className="provider-details-section"
      css={providerDetailsSectionCSS}
      aria-labelledby={headingId}
    >
      <Heading level={3} id={headingId} weight="heavy">
        {title}
      </Heading>
      <dl className="provider-details-section__list">
        {details.map((detail) => (
          <div key={detail.label} className="provider-details-section__item">
            <dt className="provider-details-section__term">{detail.label}</dt>
            <dd className="provider-details-section__description">
              <ProviderDetailValueView value={detail.value} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
