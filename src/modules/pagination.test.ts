import { expect, test } from "vitest";
import { pageNumbers, pageWindow } from "./pagination";

test("pageWindow reports the real range and clamps bad pages", () => {
  expect(pageWindow(148, "2")).toMatchObject({ page: 2, pageCount: 8, offset: 20, from: 21, to: 40 });
  expect(pageWindow(148, "8")).toMatchObject({ page: 8, from: 141, to: 148 });
  expect(pageWindow(148, "99")).toMatchObject({ page: 8 });
  for (const bad of [undefined, "", "0", "-3", "2.5", "abc", "1e9", ["2"]]) expect(pageWindow(148, bad).page).toBe(1);
  expect(pageWindow(0, "3")).toMatchObject({ page: 1, pageCount: 1, from: 0, to: 0 });
  expect(pageWindow(20, "2")).toMatchObject({ page: 1, pageCount: 1 });
});

test("pageNumbers keeps the ends and the current neighbourhood, with gaps", () => {
  expect(pageNumbers({ page: 1, pageCount: 1 })).toEqual([1]);
  expect(pageNumbers({ page: 2, pageCount: 4 })).toEqual([1, 2, 3, 4]);
  expect(pageNumbers({ page: 1, pageCount: 8 })).toEqual([1, 2, null, 8]);
  expect(pageNumbers({ page: 5, pageCount: 12 })).toEqual([1, null, 4, 5, 6, null, 12]);
  expect(pageNumbers({ page: 12, pageCount: 12 })).toEqual([1, null, 11, 12]);
});
