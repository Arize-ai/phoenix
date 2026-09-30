import type { Meta, StoryFn, StoryObj } from "@storybook/react";
import { Link } from "react-router";

import { Breadcrumb, Breadcrumbs } from "@phoenix/components";
import type { BreadcrumbProps } from "@phoenix/components/core/breadcrumbs";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * The trail of pages above the current one, ending with the current page.
 * A link crumb underlines on hover and truncates past 40 characters; a crumb
 * whose content is plain text does neither.
 */
const meta: Meta = {
  title: "Design System/Navigation/Breadcrumbs",
  component: Breadcrumbs,
  subcomponents: { Breadcrumb },
  tags: ["updated", "unreviewed", "incomplete"],
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

type Crumb = { name: string; to: string };

const DATASET_EVALUATORS: Crumb[] = [
  { name: "Datasets", to: "/datasets" },
  { name: "qa-golden-set", to: "/datasets/RGF0YXNldDox" },
  { name: "evaluators", to: "/datasets/RGF0YXNldDox/evaluators" },
];

const SIZES: {
  label: NonNullable<BreadcrumbProps<object>["size"]>;
  code: true;
}[] = [
  { label: "S", code: true },
  { label: "M", code: true },
  { label: "L", code: true },
];

const CONTENT: { label: string; asLinks: boolean }[] = [
  { label: "Links", asLinks: true },
  { label: "Text", asLinks: false },
];

const LENGTHS: { label: string; crumbs: Crumb[] }[] = [
  { label: "One crumb", crumbs: [{ name: "Projects", to: "/projects" }] },
  { label: "Regular", crumbs: DATASET_EVALUATORS },
  {
    label: "Long name",
    crumbs: [
      { name: "Projects", to: "/projects" },
      {
        name: "customer-support-agent-production-us-east-1-canary-rollout",
        to: "/projects/UHJvamVjdDoy",
      },
      { name: "Traces", to: "/projects/UHJvamVjdDoy/traces" },
    ],
  },
];

function Trail({
  crumbs,
  size = "L",
  asLinks = true,
}: {
  crumbs: Crumb[];
  size?: BreadcrumbProps<object>["size"];
  asLinks?: boolean;
}) {
  return (
    <Breadcrumbs size={size}>
      {crumbs.map((crumb) => (
        <Breadcrumb key={crumb.to}>
          {asLinks ? (
            <Link to={crumb.to} title={crumb.name}>
              {crumb.name}
            </Link>
          ) : (
            crumb.name
          )}
        </Breadcrumb>
      ))}
    </Breadcrumbs>
  );
}

export const Default: StoryFn = () => <Trail crumbs={DATASET_EVALUATORS} />;
Default.tags = ["!dev"];

export const SizesAndContent: StoryFn = () => (
  <OptionGrid
    rows={SIZES}
    columns={CONTENT}
    renderCell={(size, content) => (
      <Trail
        crumbs={DATASET_EVALUATORS}
        size={size.label}
        asLinks={content?.asLinks}
      />
    )}
  />
);
SizesAndContent.tags = ["!dev"];
SizesAndContent.parameters = { themeLayout: "column" };

export const ContentLength: StoryFn = () => (
  <OptionGrid
    rows={LENGTHS}
    renderCell={(length) => <Trail crumbs={length.crumbs} />}
  />
);
ContentLength.tags = ["!dev"];
ContentLength.parameters = { themeLayout: "column" };

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => <Trail crumbs={DATASET_EVALUATORS} size="M" />,
};
