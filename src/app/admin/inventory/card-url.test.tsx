import type { ReactElement } from "react";
import { afterEach, expect, test, vi } from "vitest";

const { setMessage } = vi.hoisted(() => ({ setMessage: vi.fn() }));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useState: () => ["", setMessage],
}));
import { CardUrl } from "./card-url";

afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
const url = "http://localhost:3000/c/" + "A".repeat(26);
const clickCopy = () => {
  const children = CardUrl({ url }).props.children as ReactElement<{ onClick: () => Promise<void> }>[];
  return children[1].props.onClick();
};

test("copies only the supplied public URL and announces success", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  await clickCopy();
  expect(writeText).toHaveBeenCalledExactlyOnceWith(url);
  expect(setMessage).toHaveBeenCalledWith("Card URL copied.");
});

test("unavailable clipboard gives manual-copy instructions without throwing", async () => {
  vi.stubGlobal("navigator", {});
  await clickCopy();
  expect(setMessage).toHaveBeenCalledWith("Could not copy. Select the address and copy it manually.");
});
