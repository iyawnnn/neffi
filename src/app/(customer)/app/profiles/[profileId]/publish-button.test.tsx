// @vitest-environment happy-dom
import {act} from "react";
import {createRoot} from "react-dom/client";
import {expect,test,vi} from "vitest";
import {PublishButton} from "./publish-button";
test("publishes only on explicit submit, preserves route identifiers, and focuses a retryable error",async()=>{
 vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);const host=document.createElement("div");document.body.append(host);const root=createRoot(host);const action=vi.fn().mockResolvedValue({error:"Try again",gaps:["Add your full name."]});
 try{await act(async()=>root.render(<PublishButton profileId="p1" cardId="c1" action={action}/>));expect(action).not.toHaveBeenCalled();await act(async()=>host.querySelector<HTMLButtonElement>('button')!.click());expect(action).toHaveBeenCalledTimes(1);const data=action.mock.calls[0][1] as FormData;expect(data.get('profileId')).toBe('p1');expect(data.get('cardId')).toBe('c1');expect(host.textContent).toContain('Add your full name.');expect(document.activeElement?.getAttribute('role')).toBe('alert');expect(host.querySelector<HTMLButtonElement>('button')!.disabled).toBe(false);
 }finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals()}
});
