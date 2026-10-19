"use client";

import { useId, type ReactNode } from "react";
import { Input, Textarea, inputClass } from "@/components/ui/input";
import { PLATFORMS } from "@/modules/profiles/platform-registry";
import type { LinkKind } from "@/modules/profiles/block-options";
import type { BlockType } from "@/modules/profiles/block-content";

export function ItemFields({ type, content = {}, editing = false, errors = {} }: { type: BlockType; content?: Record<string, unknown>; editing?: boolean; errors?: Record<string, string> }) {
  const id = useId();
  const value = (key: string) => typeof content[key] === "string" ? content[key] as string : "";
  const field = (name: string, label: string, control: ReactNode, optional = false) => <div className="flex min-w-0 flex-col gap-1.5">
    <label htmlFor={`${id}-${name}`} className="flex justify-between gap-3 text-body font-medium">{label}{optional ? <span className="text-meta font-normal text-fg-secondary">Optional</span> : null}</label>
    {control}{errors[name] ? <p id={`${id}-${name}-error`} role="alert" className="text-meta text-destructive">{errors[name]}</p> : null}
  </div>;
  const props = (name: string) => ({ id: `${id}-${name}`, name, defaultValue: value(name), "aria-invalid": !!errors[name] || undefined, "aria-describedby": errors[name] ? `${id}-${name}-error` : undefined });
  const kind = (value("kind") || "custom") as LinkKind;
  const platform = PLATFORMS[kind];
  const url = (label: string, required = true, placeholder = "example.com") => field("url", label, <Input {...props("url")} required={required} inputMode="url" autoCapitalize="none" spellCheck={false} maxLength={2048} placeholder={placeholder} />, !required);
  const label = (text: string, placeholder: string) => field("label", text, <Input {...props("label")} maxLength={40} placeholder={placeholder} />, true);
  return <>
    <input type="hidden" name="type" value={type} />
    {type === "about" ? field("text", "About you", <Textarea {...props("text")} required maxLength={1000} className="min-h-32" />) : null}
    {type === "project" ? <>{field("title", "Project name", <Input {...props("title")} required maxLength={80} />)}{field("description", "Short description", <Textarea {...props("description")} maxLength={500} />, true)}{url("Link", false, "yoursite.com/project")}</> : null}
    {type === "link" ? <><input type="hidden" name="kind" value={kind} />{kind === "custom" ? <>{label("Label", "My website")}{url("URL")}</> : <>{url(`${platform.label} link`, true, platform.placeholder)}{label("Display label", platform.label)}</>}</> : null}
    {type === "booking" ? <>{label("Button text", "Book a meeting")}{url("Booking link", true, "calendly.com/you")}</> : null}
    {type === "contact" ? editing ? <label className="flex min-h-11 cursor-pointer items-center gap-3 text-body"><input type="checkbox" name="saveContact" defaultChecked={Boolean(content.saveContact)} className="size-4 accent-brand" />Show a Save contact button</label> : <><input type="hidden" name="saveContact" value="on" /><p className="text-body text-fg-secondary">Visitors can save the shared contact details from your profile.</p></> : null}
    {type === "form" ? field("preset", "Start with", <select id={`${id}-preset`} name="preset" defaultValue="connect" className={inputClass}><option value="connect">Connect</option><option value="project_inquiry">Project inquiry</option><option value="contact">Contact</option></select>) : null}
  </>;
}
