import { ChangeEvent, useCallback, useMemo } from "react";
import { graphql, useFragment } from "react-relay";
import { Column } from "@tanstack/react-table";
import { css } from "@emotion/react";

import {
  Button,
  DialogTrigger,
  Flex,
  Icon,
  Icons,
  Popover,
  SelectChevronUpDownIcon,
  View,
} from "@phoenix/components";
import { useTracingContext } from "@phoenix/contexts/TracingContext";

import { SessionColumnSelector_annotations$key } from "./__generated__/SessionColumnSelector_annotations.graphql";
const UN_HIDABLE_COLUMN_IDS = ["sessionId"];

type SessionColumnSelectorProps<T extends object> = {
  /**
   * The columns that can be displayed in the session table
   * This could be made more generic to support other tables
   * but for now working on the session tables to figure out the right interface
   */
  columns: Column<T>[];
  query: SessionColumnSelector_annotations$key;
};

/**
 * @todo Convert this to a multi-select with ListBox
 */
export function SessionColumnSelector<T extends object>(
  props: SessionColumnSelectorProps<T>
) {
  return (
    <DialogTrigger>
      <Button trailingVisual={<SelectChevronUpDownIcon />}>
        <Flex alignItems="center" gap="size-100">
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

/**
 * @todo Convert this to a multi-select with ListBox
 */
function ColumnSelectorMenu<T extends object>(
  props: SessionColumnSelectorProps<T>
) {
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

  const onCheckboxChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { name, checked } = event.target;
      setColumnVisibility({ ...columnVisibility, [name]: checked });
    },
    [columnVisibility, setColumnVisibility]
  );

  const onToggleAll = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const { checked } = event.target;
      const newVisibilityState = columns.reduce((acc, column) => {
        return { ...acc, [column.id]: checked };
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
            <label>
              <input
                type="checkbox"
                name={"toggle-all"}
                checked={allVisible}
                onChange={onToggleAll}
              />
              session columns
            </label>
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
                <label>
                  <input
                    type="checkbox"
                    name={column.id}
                    checked={isVisible}
                    onChange={onCheckboxChange}
                  />
                  {name}
                </label>
              </li>
            );
          })}
        </ul>
        <EvaluationColumnSelector {...props} />
      </View>
    </div>
  );
}

/**
 * @todo convert this to a multi-select with ListBox
 */
function EvaluationColumnSelector<T extends object>({
  query,
}: Pick<SessionColumnSelectorProps<T>, "query">) {
  const data = useFragment<SessionColumnSelector_annotations$key>(
    graphql`
      fragment SessionColumnSelector_annotations on Project {
        sessionAnnotationNames
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
    return data.sessionAnnotationNames.every((name) => {
      const stateValue = annotationColumnVisibility[name];
      return stateValue || false;
    });
  }, [data.sessionAnnotationNames, annotationColumnVisibility]);

  const onToggleAnnotations = useCallback(() => {
    const newVisibilityState = data.sessionAnnotationNames.reduce(
      (acc, name) => {
        return { ...acc, [name]: !allVisible };
      },
      {}
    );
    setAnnotationColumnVisibility(newVisibilityState);
  }, [data.sessionAnnotationNames, setAnnotationColumnVisibility, allVisible]);
  return (
    <section>
      <View
        paddingTop="size-50"
        paddingBottom="size-50"
        borderColor="dark"
        borderTopWidth="thin"
      >
        <div css={columCheckboxItemCSS}>
          <label>
            <input
              type="checkbox"
              name={"toggle-annotations-all"}
              checked={allVisible}
              onChange={onToggleAnnotations}
            />
            annotations
          </label>
        </div>
      </View>
      <ul>
        {data.sessionAnnotationNames.map((name) => {
          const isVisible = annotationColumnVisibility[name] ?? false;
          return (
            <li key={name} css={columCheckboxItemCSS}>
              <label>
                <input
                  type="checkbox"
                  name={name}
                  checked={isVisible}
                  onChange={() => {
                    setAnnotationColumnVisibility({
                      ...annotationColumnVisibility,
                      [name]: !isVisible,
                    });
                  }}
                />
                {name}
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
