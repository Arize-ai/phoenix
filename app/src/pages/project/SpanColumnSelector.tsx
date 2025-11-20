import { useCallback, useMemo } from "react";
import { graphql, useFragment } from "react-relay";
import { Column } from "@tanstack/react-table";
import { css } from "@emotion/react";

import {
  Button,
  Checkbox,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Popover,
  SelectChevronUpDownIcon,
  View,
} from "@phoenix/components";
import { useTracingContext } from "@phoenix/contexts/TracingContext";

import { SpanColumnSelector_annotations$key } from "./__generated__/SpanColumnSelector_annotations.graphql";
const UN_HIDABLE_COLUMN_IDS = ["spanKind", "name"];

type SpanColumnSelectorProps = {
  /**
   * The columns that can be displayed in the span table
   * This could be made more generic to support other tables
   * but for now working on the span tables to figure out the right interface
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: Column<any>[];
  query: SpanColumnSelector_annotations$key;
};

export function SpanColumnSelector(props: SpanColumnSelectorProps) {
  return (
    <DialogTrigger>
      <Button trailingVisual={<SelectChevronUpDownIcon />}>
        <Flex direction="row" alignItems="center" gap="size-100">
          <Icon svg={<Icons.Column />} />
          Columns
        </Flex>
      </Button>
      <Popover>
        <ColumnSelectorMenu {...props} />
      </Popover>
    </DialogTrigger>
  );
}

const columCheckboxItemCSS = css`
  padding: var(--ac-global-dimension-static-size-50)
    var(--ac-global-dimension-static-size-100);
  label {
    display: flex;
    align-items: center;
    gap: var(--ac-global-dimension-static-size-100);
  }
`;

function ColumnSelectorMenu(props: SpanColumnSelectorProps) {
  const { columns: propsColumns } = props;

  const columnVisibility = useTracingContext((state) => state.columnVisibility);
  const setColumnVisibility = useTracingContext(
    (state) => state.setColumnVisibility
  );
  const columns = useMemo(() => {
    return propsColumns.filter((column) => {
      return !UN_HIDABLE_COLUMN_IDS.includes(column.id);
    });
  }, [propsColumns]);

  const allVisible = useMemo(() => {
    return columns.every((column) => {
      const stateValue = columnVisibility[column.id];
      const isVisible = stateValue == null ? true : stateValue;
      return isVisible;
    });
  }, [columns, columnVisibility]);

  const someVisible = useMemo(() => {
    return columns.some((column) => {
      const stateValue = columnVisibility[column.id];
      const isVisible = stateValue == null ? true : stateValue;
      return isVisible;
    });
  }, [columns, columnVisibility]);

  const onCheckboxChange = useCallback(
    (name: string, isSelected: boolean) => {
      setColumnVisibility({ ...columnVisibility, [name]: isSelected });
    },
    [columnVisibility, setColumnVisibility]
  );

  const onToggleAll = useCallback(
    (isSelected: boolean) => {
      const newVisibilityState = columns.reduce((acc, column) => {
        return { ...acc, [column.id]: isSelected };
      }, {});
      setColumnVisibility(newVisibilityState);
    },
    [columns, setColumnVisibility]
  );

  return (
    <div
      css={css`
        overflow-y: auto;
        max-height: calc(100vh - 200px);
      `}
    >
      <View padding="size-50">
        <View
          borderBottomColor="dark"
          borderBottomWidth="thin"
          paddingBottom="size-50"
        >
          <div css={columCheckboxItemCSS}>
            <Checkbox
              name="toggle-all"
              isSelected={allVisible}
              isIndeterminate={someVisible && !allVisible}
              onChange={onToggleAll}
            >
              span columns
            </Checkbox>
          </div>
        </View>
        <ul>
          {columns.map((column) => {
            const stateValue = columnVisibility[column.id];
            const isVisible = stateValue == null ? true : stateValue;
            const name =
              typeof column.columnDef.header == "string"
                ? column.columnDef.header
                : column.id;
            return (
              <li key={column.id} css={columCheckboxItemCSS}>
                <Checkbox
                  name={column.id}
                  isSelected={isVisible}
                  onChange={(isSelected) =>
                    onCheckboxChange(column.id, isSelected)
                  }
                >
                  {name}
                </Checkbox>
              </li>
            );
          })}
        </ul>
        <EvaluationColumnSelector {...props} />
      </View>
    </div>
  );
}

function EvaluationColumnSelector({
  query,
}: Pick<SpanColumnSelectorProps, "query">) {
  const data = useFragment<SpanColumnSelector_annotations$key>(
    graphql`
      fragment SpanColumnSelector_annotations on Project {
        spanAnnotationNames
      }
    `,
    query
  );
  const annotationColumnVisibility = useTracingContext(
    (state) => state.annotationColumnVisibility
  );
  const setAnnotationColumnVisibility = useTracingContext(
    (state) => state.setAnnotationColumnVisibility
  );
  const allVisible = useMemo(() => {
    return data.spanAnnotationNames.every((name) => {
      const stateValue = annotationColumnVisibility[name];
      return stateValue || false;
    });
  }, [data.spanAnnotationNames, annotationColumnVisibility]);

  const someVisible = useMemo(() => {
    return data.spanAnnotationNames.some((name) => {
      const stateValue = annotationColumnVisibility[name];
      return stateValue || false;
    });
  }, [data.spanAnnotationNames, annotationColumnVisibility]);

  const onToggleAnnotations = useCallback(() => {
    const newVisibilityState = data.spanAnnotationNames.reduce((acc, name) => {
      return { ...acc, [name]: !allVisible };
    }, {});
    setAnnotationColumnVisibility(newVisibilityState);
  }, [data.spanAnnotationNames, setAnnotationColumnVisibility, allVisible]);
  return (
    <section>
      <View
        paddingTop="size-50"
        paddingBottom="size-50"
        borderColor="dark"
        borderTopWidth="thin"
      >
        <div css={columCheckboxItemCSS}>
          <Checkbox
            name="toggle-annotations-all"
            isSelected={allVisible}
            isIndeterminate={someVisible && !allVisible}
            onChange={onToggleAnnotations}
          >
            annotations
          </Checkbox>
        </div>
      </View>
      <ul>
        {data.spanAnnotationNames.map((name) => {
          const isVisible = annotationColumnVisibility[name] ?? false;
          return (
            <li key={name} css={columCheckboxItemCSS}>
              <Checkbox
                name={name}
                isSelected={isVisible}
                onChange={(isSelected) =>
                  setAnnotationColumnVisibility({
                    ...annotationColumnVisibility,
                    [name]: isSelected,
                  })
                }
              >
                {name}
              </Checkbox>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
