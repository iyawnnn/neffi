import { afterEach, expect, test, vi } from "vitest";
vi.mock("next/navigation",()=>({notFound:()=>{throw new Error("NOT_FOUND")},redirect:(url:string)=>{throw new Error("REDIRECT:"+url)}}));
import {previewPublishAction} from "./publish";
afterEach(()=>vi.unstubAllEnvs());
test.each([["production",""],["development","preview"]])("synthetic publish is disabled in %s/%s",async(node,vercel)=>{vi.stubEnv("NODE_ENV",node);vi.stubEnv("VERCEL_ENV",vercel);await expect(previewPublishAction(undefined,new FormData())).rejects.toThrow("NOT_FOUND")});
test("local synthetic success navigates to Done and failure stays retryable",async()=>{vi.stubEnv("NODE_ENV","development");vi.stubEnv("VERCEL_ENV","");await expect(previewPublishAction(undefined,new FormData())).rejects.toThrow("REDIRECT:/dev/setup-preview?state=published&step=done");const data=new FormData();data.set("profileId","synthetic-failure");expect(await previewPublishAction(undefined,data)).toMatchObject({error:expect.stringContaining("Try again")})});
