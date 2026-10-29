// @vitest-environment happy-dom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { CoverEditor, type CoverEditorImage } from "./cover-editor";
const m = vi.hoisted(() => ({ start: vi.fn(), confirm: vi.fn(), crop: vi.fn(), remove: vi.fn(), discard: vi.fn(), refresh: vi.fn(), busy: vi.fn() }));
vi.mock("./actions", () => ({ startImageUploadAction: m.start, confirmCoverAction: m.confirm, updateCoverCropAction: m.crop, removeCoverAction: m.remove, discardCoverUploadAction: m.discard }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: m.refresh }) }));
const existing: CoverEditorImage = { assetId: "old-cover", src: "/dev/profile-cover.svg", width: 1200, height: 400, crop: { x: 30, y: 10, width: 900 } };
let host: HTMLDivElement; let root: Root;
beforeEach(() => {
 vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); vi.resetAllMocks();
 m.start.mockResolvedValue({ ticket: { url: "https://api.cloudinary.com/v1_1/demo/image/upload", fields: { public_id: "new-cover", signature: "signed" } } });
 m.confirm.mockResolvedValue({ ok: true });m.crop.mockResolvedValue({});m.remove.mockResolvedValue(undefined);m.discard.mockResolvedValue(undefined);
 vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ public_id: "new-cover", width: 1600, height: 900, secure_url: "https://res.cloudinary.com/demo/image/upload/v1/new-cover.png" }) }));
 host=document.createElement("div"); document.body.append(host);root=createRoot(host);
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();});
async function render(cover: CoverEditorImage|null=null){await act(async()=>root.render(<CoverEditor profileId="p1" cover={cover} onBusyChange={m.busy} />));}
const button=(name:string)=>[...document.querySelectorAll<HTMLButtonElement>('button')].find(n=>(n.querySelector(":scope > .inline-grid > span:not([aria-hidden='true'])")?.textContent??n.textContent)===name)!;
async function sourceLoaded(){const image=document.querySelector('[role="dialog"] img');if(image)await act(async()=>image.dispatchEvent(new Event('load')));}
async function click(name:string){await act(async()=>button(name).click());if(name==='Reposition')await sourceLoaded();}
async function upload(file=new File(["image"],"cover.png",{type:"image/png"})){
 const input=host.querySelector<HTMLInputElement>('input[type="file"]')!;Object.defineProperty(input,"files",{value:[file],configurable:true});
 await act(async()=>input.dispatchEvent(new Event("change",{bubbles:true})));
 await sourceLoaded();
}
const dialog=()=>document.querySelector('[role="dialog"]')!;

test("optional empty state explains fallback without a permanent save helper",async()=>{
 await render();for(const text of ["Cover image","Optional","accent colour"])expect(host.textContent).toContain(text);
 expect(host.textContent).not.toContain('Cover changes save immediately.');
 expect(button("Add cover")).toBeDefined();expect(host.querySelector('input[type="file"]')!.getAttribute('accept')).toContain('image/heic');
});
test("signed upload opens centred crop, saves independently and refreshes canonical view",async()=>{
 await render();await upload();expect(m.start).toHaveBeenCalledWith("p1","cover");
 expect(dialog().textContent).toContain("Frame your cover");
 expect(dialog().querySelector('input[type="range"]')!.getAttribute('aria-label')).toBe("Cover zoom");
 expect(dialog().querySelector('img')!.getAttribute('src')).toContain('/image/upload/f_auto,q_auto/');
 expect(m.confirm).not.toHaveBeenCalled();await click("Save cover");
 expect(m.confirm).toHaveBeenCalledWith("p1","new-cover",{x:0,y:184,width:1600});
 expect(m.refresh).toHaveBeenCalledOnce();expect(document.querySelector('[role="dialog"]')).toBeNull();
});
test("cancel discards only the newly uploaded asset and never confirms it",async()=>{
 await render(existing);await upload();await click("Cancel");expect(m.discard).toHaveBeenCalledWith("p1","new-cover");expect(m.confirm).not.toHaveBeenCalled();expect(host.querySelector('img')!.getAttribute('src')).toBe(existing.src);
});
test("reposition uses stored original/crop, keyboard movement and zoom without upload",async()=>{
 await render(existing);await click("Reposition");
 const frame=dialog().querySelector<HTMLElement>('[data-crop-frame]')!;
 await act(async()=>frame.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true})));
 await click("Save cover");expect(m.crop).toHaveBeenCalledWith("p1",{x:40,y:10,width:900});expect(m.start).not.toHaveBeenCalled();expect(m.confirm).not.toHaveBeenCalled();expect(m.discard).not.toHaveBeenCalled();
});
test("pointer dragging and range zoom stay bounded",async()=>{
 await render(existing);await click("Reposition");
 const frame=dialog().querySelector<HTMLElement>('[data-crop-frame]')!;
 vi.spyOn(frame,'getBoundingClientRect').mockReturnValue({width:300,height:100,left:0,top:0,right:300,bottom:100,x:0,y:0,toJSON:()=>({})});
 frame.setPointerCapture=vi.fn();frame.releasePointerCapture=vi.fn();
 await act(async()=>{frame.dispatchEvent(new PointerEvent('pointerdown',{clientX:100,clientY:50,pointerId:1,bubbles:true}));frame.dispatchEvent(new PointerEvent('pointermove',{clientX:90,clientY:45,pointerId:1,bubbles:true}));frame.dispatchEvent(new PointerEvent('pointerup',{pointerId:1,bubbles:true}));});
 const zoom=dialog().querySelector<HTMLInputElement>('input[type="range"]')!;
 const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!;
 await act(async()=>{setter.call(zoom,'2');zoom.dispatchEvent(new Event('input',{bubbles:true}));zoom.dispatchEvent(new Event('change',{bubbles:true}));});
 await click("Save cover");const crop=m.crop.mock.calls[0][1];expect(crop.width).toBe(600);expect(crop.x).toBeGreaterThanOrEqual(0);expect(crop.x+crop.width).toBeLessThanOrEqual(1200);expect(crop.y+Math.round(crop.width/3)).toBeLessThanOrEqual(400);
});
test("remove is intentional and failures preserve the previous cover",async()=>{
 await render(existing);m.remove.mockRejectedValueOnce(new Error('internal provider error'));
 await click("Remove cover");expect(dialog().textContent).toContain("Remove cover?");await click("Remove");
 expect(m.remove).toHaveBeenCalledWith("p1");expect(host.querySelector('img')).not.toBeNull();expect(document.body.textContent).not.toContain('internal provider error');
 await click("Remove");expect(m.refresh).toHaveBeenCalledOnce();expect(host.querySelector('img')).toBeNull();expect(button('Add cover')).toBeDefined();
});
test("bad type and size rejected before signing; insufficient resolution discards candidate",async()=>{
 await render();await upload(new File(['x'],'cover.svg',{type:'image/svg+xml'}));expect(m.start).not.toHaveBeenCalled();
 await upload(new File([new Uint8Array(5000001)],'cover.png',{type:'image/png'}));expect(m.start).not.toHaveBeenCalled();
 vi.mocked(fetch).mockResolvedValueOnce({ok:true,json:async()=>({public_id:'new-cover',width:1600,height:199,secure_url:'https://res.cloudinary.com/demo/image/upload/cover.png'})} as Response);
 await upload();expect(host.textContent).toContain('600');expect(m.discard).toHaveBeenCalledWith('p1','new-cover');expect(document.querySelector('[role="dialog"]')).toBeNull();
});
test("upload and confirmation failure preserve active cover and do not expose internals",async()=>{
 await render(existing);vi.mocked(fetch).mockRejectedValueOnce(new Error('provider stack'));await upload();expect(host.querySelector('img')).not.toBeNull();expect(host.textContent).not.toContain('provider stack');
 await upload();m.confirm.mockResolvedValueOnce({error:'Adjust the crop to fit the image.'});await click('Save cover');expect(dialog()).not.toBeNull();expect(host.querySelector('img')!.getAttribute('src')).toBe(existing.src);
});
test("cancel reposition stores nothing and never discards the active asset",async()=>{
 await render(existing);await click('Reposition');await click('Cancel');expect(m.discard).not.toHaveBeenCalled();expect(m.crop).not.toHaveBeenCalled();
});
test("pending operations prevent duplicates and disable cover controls",async()=>{
 const pending=Promise.withResolvers<{ok:true}>();m.confirm.mockReturnValue(pending.promise);
 await render();await upload();await click('Save cover');expect(button('Saving cover...').disabled).toBe(true);
 await act(async()=>pending.resolve({ok:true}));expect(m.confirm).toHaveBeenCalledOnce();
});

test("full-width cover and grouped actions retain a restrained outlined remove target and accessible zoom controls",async()=>{
 await render(existing);
 const remove=button('Remove cover');expect(remove.className).toContain('h-11');expect(remove.className).toContain('border-destructive/30');
 expect(remove.parentElement).toBe(button('Reposition').parentElement!.parentElement);
 expect(remove.className).toContain('w-full');expect(remove.className).toContain('sm:w-auto');
 const image=host.querySelector('img')!;
 expect(image.parentElement!.className).toContain('w-full');expect(image.parentElement!.className).not.toContain('max-w-');
 expect(image.parentElement!.className).toContain('aspect-[3/1]');expect(image.className).toContain('object-cover');
 expect(host.textContent).not.toContain('Cover changes save immediately.');
 await upload();
 const zoom=dialog().querySelector<HTMLInputElement>('input[type="range"]')!;
 const control=(name:string)=>dialog().querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!;
 expect(zoom.getAttribute('aria-label')).toBe('Cover zoom');expect(zoom.getAttribute('aria-valuetext')).toBe('100%');
 expect(dialog().querySelector('output')!.textContent).toBe('100%');expect(control('Zoom out').disabled).toBe(true);
 await act(async()=>control('Zoom in').click());expect(dialog().querySelector('output')!.textContent).toBe('110%');expect(zoom.getAttribute('aria-valuetext')).toBe('110%');
 await act(async()=>control('Zoom out').click());expect(dialog().querySelector('output')!.textContent).toBe('100%');
 const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!;
 await act(async()=>{setter.call(zoom,String(1600/600));zoom.dispatchEvent(new Event('input',{bubbles:true}));zoom.dispatchEvent(new Event('change',{bubbles:true}));});
 expect(control('Zoom in').disabled).toBe(true);expect(dialog().querySelector('output')!.textContent).toBe('267%');
 await click('Save cover');expect(m.confirm.mock.calls[0][2].width).toBe(600);
});

test("source loading failures prevent saving a blank cover but allow cancellation",async()=>{
 await render(existing);await click('Reposition');
 const image=dialog().querySelector('img')!;
 await act(async()=>image.dispatchEvent(new Event('error')));
 expect(button('Save cover').disabled).toBe(true);expect(dialog().textContent).toContain("couldn't load");
 await click('Cancel');expect(m.crop).not.toHaveBeenCalled();expect(m.discard).not.toHaveBeenCalled();
});

test("remove releases appearance controls and a subsequent upload becomes active",async()=>{
 await render(existing);await click('Remove cover');await click('Remove');
 expect(m.busy).toHaveBeenLastCalledWith(false);
 await upload();await click('Save cover');
 expect(button('Reposition')).toBeDefined();expect(host.querySelector('img')).not.toBeNull();
});

test("failed upload releases controls and discards only its signed asset; mismatched ids never confirm",async()=>{
 await render(existing);vi.mocked(fetch).mockRejectedValueOnce(new Error('provider'));
 await upload();expect(m.busy).toHaveBeenLastCalledWith(false);expect(m.discard).toHaveBeenCalledWith('p1','new-cover');
 vi.mocked(fetch).mockResolvedValueOnce({ok:true,json:async()=>({public_id:'foreign-cover',width:1200,height:400,secure_url:'https://res.cloudinary.com/demo/image/upload/foreign.png'})} as Response);
 await upload();expect(m.discard).not.toHaveBeenCalledWith('p1','foreign-cover');expect(m.confirm).not.toHaveBeenCalled();
});
