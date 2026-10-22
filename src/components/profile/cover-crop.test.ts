import { expect, test } from "vitest";
import { initialCoverCrop, maxCoverCropWidth, moveCoverCrop, resizeCoverCrop } from "./cover-crop";

test("creates the largest centred 3:1 crop for landscape, portrait, and panorama sources", () => {
  expect(initialCoverCrop(1200, 800)).toEqual({ x: 0, y: 200, width: 1200 });
  expect(initialCoverCrop(800, 1200)).toEqual({ x: 0, y: 467, width: 800 });
  expect(initialCoverCrop(2048, 600)).toEqual({ x: 124, y: 0, width: 1800 });
});

test("accepts the minimum 600px crop and rejects unsupported source dimensions", () => {
  expect(initialCoverCrop(600, 200)).toEqual({ x: 0, y: 0, width: 600 });
  expect(initialCoverCrop(599, 1200)).toBeNull();
  expect(initialCoverCrop(1800, 199)).toBeNull();
  expect(initialCoverCrop(0, 800)).toBeNull();
  expect(initialCoverCrop(1200.5, 800)).toBeNull();
  expect(initialCoverCrop(2049, 800)).toBeNull();
  expect(maxCoverCropWidth(1200, 800)).toBe(1200);
  expect(maxCoverCropWidth(0, 800)).toBe(0);
});

test("moves crop in every direction without escaping the rounded 3:1 bounds", () => {
  const crop = { x: 300, y: 200, width: 600 };
  expect(moveCoverCrop(crop, 1200, 800, -999, -999)).toEqual({ x: 0, y: 0, width: 600 });
  expect(moveCoverCrop(crop, 1200, 800, 999, 999)).toEqual({ x: 600, y: 600, width: 600 });
  expect(moveCoverCrop(crop, 1200, 800, 10.6, -10.6)).toEqual({ x: 311, y: 189, width: 600 });
});

test("resizes within source limits while retaining the crop centre", () => {
  const crop = { x: 100, y: 100, width: 600 };
  expect(resizeCoverCrop(crop, 1600, 900, 200)).toEqual({ x: 100, y: 100, width: 600 });
  expect(resizeCoverCrop(crop, 1600, 900, 3000)).toEqual({ x: 0, y: 0, width: 1600 });
  expect(resizeCoverCrop(crop, 1600, 900, 900.6)).toEqual({ x: 0, y: 50, width: 901 });
});

test("repeated fractional moves and zooms retain valid rounded crop bounds", () => {
  let crop = initialCoverCrop(1001, 601)!;
  for (let index = 0; index < 20; index += 1) {
    crop = resizeCoverCrop(crop, 1001, 601, 600 + index * 17.4);
    crop = moveCoverCrop(crop, 1001, 601, index % 2 ? 999.2 : -999.2, index % 3 ? 999.2 : -999.2);
    expect(crop.x).toBeGreaterThanOrEqual(0);
    expect(crop.y).toBeGreaterThanOrEqual(0);
    expect(crop.x + crop.width).toBeLessThanOrEqual(1001);
    expect(crop.y + Math.round(crop.width / 3)).toBeLessThanOrEqual(601);
  }
});
