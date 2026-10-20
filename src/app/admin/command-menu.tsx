"use client";

import { CommandPalette } from "./command-palette";
import { useRecordSearch } from "./search/use-record-search";

export { CommandMenuField, CommandMenuIconButton } from "./command-palette";

export function CommandMenu() {
  return <CommandPalette useSearch={useRecordSearch} />;
}
