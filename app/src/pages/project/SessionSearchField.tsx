import { Input } from "react-aria-components";

import { SearchField, SearchIcon } from "@phoenix/components";

import { useSessionSearchContext } from "./SessionSearchContext";

type SessionSearchFieldProps = {
  placeholder?: string;
};

export function SessionSearchField({
  placeholder = "Search messages or session ID",
}: SessionSearchFieldProps) {
  const { filterIoSubstringOrSessionId, setFilterIoSubstringOrSessionId } =
    useSessionSearchContext();

  return (
    <SearchField
      aria-label="Search sessions"
      value={filterIoSubstringOrSessionId}
      onChange={setFilterIoSubstringOrSessionId}
      size="S"
    >
      <SearchIcon />
      <Input placeholder={placeholder} />
    </SearchField>
  );
}
