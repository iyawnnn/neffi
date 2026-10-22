import "server-only";
import { z } from "zod";

export const coverCropSchema = z.object({
  x: z.number().int().min(0).max(2048),
  y: z.number().int().min(0).max(2048),
  width: z.number().int().min(600).max(2048),
});
export type CoverCrop = z.infer<typeof coverCropSchema>;
export const profileCoverSchema = z.object({
  assetId: z.string(),
  width: z.number().int().min(1).max(2048),
  height: z.number().int().min(1).max(2048),
  crop: coverCropSchema,
}).refine(({ width, height, crop }) => crop.x + crop.width <= width && crop.y + Math.round(crop.width / 3) <= height);
export type ProfileCover = z.infer<typeof profileCoverSchema>;
