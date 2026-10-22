// @vitest-environment happy-dom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, afterEach, expect, test, vi } from "vitest";
vi.mock("next/navigation", () => ({ useRouter: () => ({push:vi.fn()}) }));
import { SetupAppearance } from "./setup-appearance";
import { setupDraft } from "./setup-draft";
beforeEach(()=>vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true));
afterEach(()=>vi.unstubAllGlobals());
test("Look recommends advisory Goal layout while preserving the saved selection and real cover",async()=>{
 const host=document.createElement("div");document.body.append(host);const root=createRoot(host);const action=vi.fn();
 const view=setupDraft(null,{fullName:"Ana"}); view.appearance.layout="showcase";view.appearance.cover={src:"/cover.svg",srcSet:"/cover.svg 640w"};
 try{
 await act(async()=>root.render(<SetupAppearance step="look" cardId="c1" suffix="TEST" goal="business" view={view} action={action}/>));
 expect(host.textContent).toContain("Recommended");expect(host.querySelector<HTMLInputElement>('[name=layout][value=showcase]')!.checked).toBe(true);
 expect(host.querySelector('img[src="/cover.svg"]')).not.toBeNull();expect(action).not.toHaveBeenCalled();
 await act(async()=>root.render(<SetupAppearance step="look" cardId="c1" suffix="TEST" goal="networking" view={view} action={action}/>));
 expect(host.querySelector<HTMLInputElement>('[name=layout][value=showcase]')!.checked).toBe(true);
 expect([...host.querySelectorAll('a')].find(a=>a.textContent==='Skip for now')?.getAttribute('href')).toBe('?step=style');
 }finally{await act(async()=>root.unmount());host.remove()}
});
test("Colours offers exactly two modes and eight named accents, previews unsaved changes, and saves only on Continue",async()=>{
 const host=document.createElement("div");document.body.append(host);const root=createRoot(host);const action=vi.fn().mockResolvedValue({error:"Try again"});
 try{
 await act(async()=>root.render(<SetupAppearance step="style" cardId="c1" suffix="TEST" goal={null} view={setupDraft(null,{fullName:"Ana"})} action={action}/>));
 expect(host.querySelectorAll('[name=colorMode]')).toHaveLength(2);expect(host.querySelectorAll('[name=accentColor]')).toHaveLength(8);expect(host.textContent).not.toContain('Recommended');
 await act(async()=>host.querySelector<HTMLInputElement>('[name=colorMode][value=dark]')!.click());
 expect((host.querySelector('[data-layout]') as HTMLElement)?.style.colorScheme).toBe('dark');expect(action).not.toHaveBeenCalled();
 await act(async()=>host.querySelector<HTMLButtonElement>('button[type=submit]')!.click());
 expect(action).toHaveBeenCalledTimes(1);expect((action.mock.calls[0][1] as FormData).get('colorMode')).toBe('dark');expect(host.textContent).toContain('Try again');
 }finally{await act(async()=>root.unmount());host.remove()}
});
