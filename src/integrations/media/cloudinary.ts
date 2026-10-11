import "server-only";
import { createHash, randomUUID } from "node:crypto";

// Browser → Cloudinary signed uploads, verified server-side before Neffi stores the id. No SDK: one signing rule
// and two HTTP calls. The API secret never leaves this module.
export type CloudinaryConfig = { cloudName: string; apiKey: string; apiSecret: string };
export const IMAGE_FORMATS = ["jpg", "png", "webp", "heic"] as const;
export const MAX_IMAGE_BYTES = 5_000_000;
const MAX_SIDE = 2048;
const INCOMING = `c_limit,h_${MAX_SIDE},w_${MAX_SIDE}`;

// Cloudinary's signature: SHA-1 of the sorted key=value pairs joined by "&", followed by the API secret.
export function sign(params: Record<string, string | number>, apiSecret: string): string {
  const payload = Object.keys(params).sort().map((key) => `${key}=${params[key]}`).join("&");
  return createHash("sha1").update(payload + apiSecret).digest("hex");
}

export type ImageUploadTicket = { url: string; fields: Record<string, string> };

export function signImageUpload(config: CloudinaryConfig, { profileId, now = new Date() }: { profileId: string; now?: Date }): ImageUploadTicket {
  const params = {
    allowed_formats: IMAGE_FORMATS.join(","),
    public_id: `neffi/profiles/${profileId}/${randomUUID()}`,
    timestamp: String(Math.floor(now.getTime() / 1000)),
    transformation: INCOMING,
  };
  return { url: `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`, fields: { ...params, api_key: config.apiKey, signature: sign(params, config.apiSecret) } };
}

export const isProfileImageId = (profileId: string, publicId: string) =>
  publicId.startsWith(`neffi/profiles/${profileId}/`) && /^[0-9a-f-]{36}$/.test(publicId.slice(`neffi/profiles/${profileId}/`.length));

export const checkImage = (image: { bytes: number; width: number; height: number; format: string }) =>
  image.bytes <= MAX_IMAGE_BYTES && image.width <= MAX_SIDE && image.height <= MAX_SIDE && (IMAGE_FORMATS as readonly string[]).includes(image.format);

export async function getImage(config: CloudinaryConfig, publicId: string) {
  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/resources/image/upload/${publicId}`, {
    headers: { Authorization: `Basic ${btoa(`${config.apiKey}:${config.apiSecret}`)}` },
    cache: "no-store",
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Media check failed");
  const { bytes, width, height, format } = (await response.json()) as { bytes: number; width: number; height: number; format: string };
  return { bytes, width, height, format };
}

export async function destroyImage(config: CloudinaryConfig, publicId: string): Promise<void> {
  const params = { invalidate: "true", public_id: publicId, timestamp: String(Math.floor(Date.now() / 1000)) };
  const body = new URLSearchParams({ ...params, api_key: config.apiKey, signature: sign(params, config.apiSecret) });
  const response = await fetch(`https://api.cloudinary.com/v1_1/${config.cloudName}/image/destroy`, { method: "POST", body });
  if (!response.ok) throw new Error("Media delete failed");
}

export function imageUrl(cloudName: string, publicId: string, isLogo: boolean): string {
  const transformation = isLogo ? "c_fit,w_256,h_256,f_auto,q_auto" : "c_fill,g_face,w_256,h_256,f_auto,q_auto";
  return `https://res.cloudinary.com/${cloudName}/image/upload/${transformation}/${publicId}`;
}
