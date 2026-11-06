import { css } from "@emotion/react";
import type { ReactNode } from "react";
import { Children, useState } from "react";
import type { Control, FieldPath } from "react-hook-form";
import { useFormState, useWatch } from "react-hook-form";

import {
  Disclosure,
  DisclosurePanel,
  DisclosureTrigger,
  SectionHeading,
} from "@phoenix/components";

import type { ProviderFormData } from "./CustomProviderForm";

const providerFormSectionCSS = css`
  & + & {
    border-top: 1px solid var(--global-border-color-default);
  }
  .provider-form-section__body {
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-100);
    padding: var(--global-dimension-size-200);
  }
`;

/**
 * A full-width section of the custom provider form: a heading bar with an
 * optional subtitle and controls, over the section's fields. Consecutive
 * sections are separated by a rule, so the form reads as one panel.
 */
export function ProviderFormSection({
  title,
  subtitle,
  extra,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  /** Controls in the heading bar, e.g. a switch or a test button. */
  extra?: ReactNode;
  /** Omit to show only the heading bar. */
  children?: ReactNode;
}) {
  return (
    <section className="provider-form-section" css={providerFormSectionCSS}>
      <SectionHeading bordered={false} subtitle={subtitle} extra={extra}>
        {title}
      </SectionHeading>
      {/* Children that all render nothing leave only the heading bar. */}
      {Children.toArray(children).length > 0 ? (
        <div className="provider-form-section__body">{children}</div>
      ) : null}
    </section>
  );
}

const optionalFieldsCSS = css`
  & > .react-aria-Heading .react-aria-Button[slot="trigger"] {
    padding: var(--global-dimension-size-50) 0;
    border-bottom: none;
    color: var(--global-text-color-700);
    &:hover:not([disabled]) {
      background-color: transparent;
      color: var(--global-text-color-900);
    }
  }
  .disclosure__panel > .optional-fields__body {
    display: flex;
    flex-direction: column;
    gap: var(--global-dimension-size-100);
    padding-top: var(--global-dimension-size-100);
  }
`;

/**
 * Optional fields folded away under a one-line toggle. It starts open when
 * any of them has a value, and stays open while any of them is invalid, so
 * an error is never hidden.
 */
export function OptionalFields({
  title,
  control,
  fields,
  children,
}: {
  title: string;
  control: Control<ProviderFormData>;
  fields: readonly FieldPath<ProviderFormData>[];
  children: ReactNode;
}) {
  const values = useWatch({
    control,
    name: fields as FieldPath<ProviderFormData>[],
  });
  const { errors } = useFormState({
    control,
    name: fields as FieldPath<ProviderFormData>[],
  });
  const [isOpen, setIsOpen] = useState(() =>
    values.some((value) => typeof value === "string" && value.trim() !== "")
  );
  const hasError = fields.some(
    (field) => (errors as Record<string, unknown>)[field] != null
  );
  return (
    <Disclosure
      css={optionalFieldsCSS}
      isExpanded={isOpen || hasError}
      onExpandedChange={setIsOpen}
    >
      <DisclosureTrigger arrowPosition="start" justifyContent="start">
        {title}
      </DisclosureTrigger>
      <DisclosurePanel>
        <div className="optional-fields__body">{children}</div>
      </DisclosurePanel>
    </Disclosure>
  );
}
