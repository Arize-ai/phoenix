import React, { useState } from "react";

import {
  Dropdown,
  Flex,
  Icon,
  Icons,
  ListBox,
  ListBoxProps,
  Popover,
  TextField,
} from "@arizeai/components";

type SearchableSelectorProps<T> = ListBoxProps<T> & {
  placeholder?: string;
  searchTerm: string;
  onSearchTermChange: (searchTerm: string) => void;
};

function getDropdownChildren<T>({
  selectedKeys,
  placeholder,
}: {
  selectedKeys: SearchableSelectorProps<T>["selectedKeys"];
  placeholder: SearchableSelectorProps<T>["placeholder"];
}) {
  if (selectedKeys == null) {
    return placeholder ?? "Select an item";
  }
  if (selectedKeys === "all") {
    return "All items selected";
  }

  const keyArray = Array.from(selectedKeys);
  if (keyArray.length === 0) {
    return placeholder ?? "Select an item";
  }

  if (keyArray.length === 1) {
    return keyArray[0];
  }

  return `${keyArray[0]} and ${keyArray.length - 1} more`;
}

export function SearchableSelector<T>(props: SearchableSelectorProps<T>) {
  return (
    <Dropdown
      menu={
        <>
          <TextField
            addonBefore={<Icon svg={<Icons.SearchOutline />} />}
            value={props.searchTerm}
            onChange={props.onSearchTermChange}
          />
          <ListBox {...props} />
        </>
      }
    >
      {getDropdownChildren({
        selectedKeys: props.selectedKeys,
        placeholder: props.placeholder,
      })}
    </Dropdown>
  );
}
