import { css } from "@emotion/react";
import type { Meta, StoryFn, StoryObj } from "@storybook/react";
import { useState } from "react";

import type { TagGroupItem } from "@phoenix/components";
import {
  Button,
  EditableTagGroup,
  Form,
  Input,
  Label,
  PageHeader,
  TagPicker,
  TextField,
  View,
} from "@phoenix/components";
import { fieldBaseCSS } from "@phoenix/components/core/field/styles";

import { OptionGrid } from "../../utils/OptionGrid";

/**
 * A set of tags a person edits where it is shown, in a form or a page
 * header (PHX-1678). The set is a removable `TagGroup`; beside it an add
 * control ("Add label") opens a `TagPicker`: every option with its color
 * swatch, the attached ones checked, a search field, and "Create new label"
 * when the caller can create one.
 *
 * Neither component holds data. The caller passes the items and the
 * options, and saves the change: at once in a page header (the dataset and
 * prompt pages), or on submit in a form (the dataset create and edit
 * forms). Without `onRemove` and `picker` the group is read-only.
 *
 * Keyboard: the set is one tab stop and the arrow keys move between tags;
 * Delete or Backspace removes the focused tag and focus moves to the next.
 * When the last tag goes, focus moves to the add control, the next tab
 * stop. A press on a tag's × removes it too, named "Remove {label}".
 */
const meta: Meta = {
  title: "Design System/Badges/Editable Tag Group",
  component: EditableTagGroup,
  subcomponents: { TagPicker },
  tags: ["updated", "unreviewed", "incomplete"],
  parameters: {
    layout: "centered",
    controls: { disable: true },
  },
};

export default meta;

const OPTIONS: TagGroupItem[] = [
  { id: "production", label: "production", userColor: "#33c5e8" },
  { id: "banking", label: "banking", userColor: "#ffa037" },
  { id: "needs-review", label: "needs-review", userColor: "#ff95bd" },
  { id: "golden", label: "golden", userColor: "#4ecf50" },
  { id: "regression", label: "regression", userColor: "#cca4fd" },
  { id: "untriaged", label: "untriaged" },
];

const MANY_OPTIONS: TagGroupItem[] = Array.from({ length: 14 }, (_, index) => ({
  id: `label-${index + 1}`,
  label: `label-${String(index + 1).padStart(2, "0")}`,
  userColor: OPTIONS[index % 5].userColor ?? "#33c5e8",
}));

/**
 * The group as a domain wrapper drives it: the set lives with the caller,
 * the picker hands back the whole new set, and a created option joins it.
 */
function LabelsHarness({
  options: initialOptions = OPTIONS,
  initialIds,
  isCreatable = true,
}: {
  options?: TagGroupItem[];
  initialIds: string[];
  isCreatable?: boolean;
}) {
  const [options, setOptions] = useState(initialOptions);
  const [ids, setIds] = useState(initialIds);
  const items = options.filter((option) => ids.includes(option.id));
  return (
    <EditableTagGroup
      aria-label="Dataset labels"
      items={items}
      onRemove={(removed) => setIds(ids.filter((id) => !removed.has(id)))}
      picker={
        <TagPicker
          options={options}
          selectedKeys={ids}
          onSelectionChange={(selected) => setIds([...selected])}
          renderCreateForm={
            isCreatable
              ? ({ onDone }) => (
                  <CreateLabelForm
                    onCreate={(name) => {
                      const id = `created-${options.length}`;
                      setOptions([...options, { id, label: name }]);
                      setIds([...ids, id]);
                      onDone();
                    }}
                  />
                )
              : undefined
          }
        />
      }
    />
  );
}

function CreateLabelForm({ onCreate }: { onCreate: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <View padding="size-200">
      <Form
        onSubmit={(event) => {
          event.preventDefault();
          if (name) {
            onCreate(name);
          }
        }}
      >
        <TextField value={name} onChange={setName}>
          <Label>Label Name</Label>
          <Input />
        </TextField>
        <Button type="submit" variant="primary" size="S">
          Create Label
        </Button>
      </Form>
    </View>
  );
}

const STATES: {
  label: string;
  render: () => React.ReactNode;
}[] = [
  {
    label: "Read-only",
    render: () => (
      <EditableTagGroup
        aria-label="Dataset labels"
        items={OPTIONS.slice(0, 3)}
      />
    ),
  },
  {
    label: "Editable",
    render: () => (
      <LabelsHarness initialIds={["production", "banking", "needs-review"]} />
    ),
  },
  {
    label: "Empty",
    render: () => <LabelsHarness initialIds={[]} />,
  },
  {
    label: "No create",
    render: () => (
      <LabelsHarness initialIds={["production"]} isCreatable={false} />
    ),
  },
];

export const Default: StoryFn = () => (
  <LabelsHarness initialIds={["production", "banking"]} />
);
Default.tags = ["!dev"];

export const States: StoryFn = () => (
  <OptionGrid rows={STATES} renderCell={(state) => state.render()} />
);
States.tags = ["!dev"];
States.parameters = { themeLayout: "column" };

const constrainedCSS = css`
  width: 320px;
  border-inline-end: 1px dashed var(--global-border-color-default);
`;

/**
 * Many labels wrap onto as many rows as they need, with the add control
 * after the last; an editable set never collapses, since a hidden tag
 * cannot be removed where it sits.
 */
export const ManyLabels: StoryFn = () => (
  <div css={constrainedCSS}>
    <LabelsHarness
      options={MANY_OPTIONS}
      initialIds={MANY_OPTIONS.slice(0, 11).map((option) => option.id)}
    />
  </div>
);
ManyLabels.tags = ["!dev"];
ManyLabels.parameters = { themeLayout: "column" };

/**
 * As a form field, as in the dataset create and edit forms: the change is
 * the form's until it is submitted.
 */
export const InAForm: StoryFn = () => (
  <View width="400px">
    <Form>
      <TextField defaultValue="qa-golden-set">
        <Label>Dataset Name</Label>
        <Input />
      </TextField>
      <div css={fieldBaseCSS}>
        <Label elementType="span">Labels</Label>
        <LabelsHarness initialIds={["production"]} />
      </div>
    </Form>
  </View>
);
InAForm.storyName = "In a Form";
InAForm.tags = ["!dev"];
InAForm.parameters = { themeLayout: "column" };

/**
 * In the `labels` row of a `PageHeader`, as on the dataset and prompt pages,
 * where each change saves at once.
 */
export const InPageHeader: StoryFn = () => (
  <View
    width="560px"
    borderWidth="thin"
    borderColor="default"
    borderRadius="medium"
  >
    <PageHeader
      title="banking_saas_dataset"
      subTitle="banking_saas_dataset.jsonl"
      labels={<LabelsHarness initialIds={["production", "banking"]} />}
      extra={<Button variant="primary">Experiment</Button>}
    />
  </View>
);
InPageHeader.storyName = "In a Page Header";
InPageHeader.tags = ["!dev"];
InPageHeader.parameters = { themeLayout: "column" };

/** The Overview card picture. See `stories/_meta/thumbnail.ts`. */
export const Thumbnail: StoryObj = {
  tags: ["!dev", "!autodocs"],
  render: () => <LabelsHarness initialIds={["production", "banking"]} />,
};
