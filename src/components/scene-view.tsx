import { LinkKindIcon } from "@/components/social-icons";
import { PLATFORMS } from "@/modules/profiles/platform-registry";
import type { CSSProperties } from "react";
import { PublicForm } from "@/components/public-form";
import { Input, Textarea } from "@/components/ui/input";
import type { SceneView } from "@/modules/profiles/scene-view";

const actionClass = "inline-flex min-h-12 w-full items-center justify-center rounded-lg border px-4 text-center font-medium";
const rowClass = "inline-flex min-h-11 items-center break-all";
const telHref = (phone: string) => `tel:${phone.replace(/[^+\d]/g, "")}`;

// The one renderer for what a visitor sees. The owner preview passes no visitorActions and gets inert controls; the public
// card page passes them and gets the working Save contact link and form.
export function SceneViewPreview({ view, visitorActions }: { view: SceneView; visitorActions?: { saveContactHref: string } }) {
  const { identity } = view;
  return (
    <article
      style={{ "--accent": identity.accent, "--on-accent": identity.onAccent } as CSSProperties}
      className={visitorActions ? "mx-auto flex w-full max-w-[560px] flex-col gap-5 px-5 py-10" : "mx-auto flex w-full max-w-[390px] flex-col gap-4 rounded-2xl border bg-background p-5"}
    >
      <header className="flex flex-col items-center gap-2 text-center">
        {identity.image ? (
          <img src={identity.image.url} alt="" width={96} height={96} decoding="async" className={`size-24 ${identity.image.isLogo ? "object-contain" : "rounded-full object-cover"}`} />
        ) : (
          <div className="flex size-24 items-center justify-center rounded-full text-2xl font-medium" style={{ background: "var(--accent)", color: "var(--on-accent)" }}>{identity.initials}</div>
        )}
        <h1 className="break-words text-3xl font-medium tracking-tight">{identity.fullName}</h1>
        {identity.headline ? <p className="break-words text-lg">{identity.headline}</p> : null}
        {identity.company ? <p className="break-words text-sm text-[#74736F]">{identity.company}</p> : null}
        {identity.location ? <p className="break-words text-sm text-[#74736F]">{identity.location}</p> : null}
      </header>
      {view.blocks.map(block => {
        if (block.type === "about") return <p key={block.id} className="whitespace-pre-line break-words leading-7">{block.text}</p>;
        if (block.type === "project") return (
          <section key={block.id} className="flex flex-col gap-2 rounded-xl border border-[#D8D5CE] p-4">
            <h2 className="break-words text-lg font-medium">{block.title}</h2>
            {block.description ? <p className="whitespace-pre-line break-words text-sm leading-6">{block.description}</p> : null}
            {block.url ? <a href={block.url} target="_blank" rel="noopener noreferrer" className={actionClass} style={{ borderColor: "var(--accent)" }}>View project</a> : null}
          </section>
        );
        if (block.type === "link" || block.type === "booking") return (
          <a key={block.id} href={block.url} target="_blank" rel="noopener noreferrer" className={actionClass}
            style={block.type === "booking" ? { background: "var(--accent)", color: "var(--on-accent)", borderColor: "var(--accent)" } : { borderColor: "var(--accent)" }}>{block.type === "link" && PLATFORMS[block.kind].publicIcon ? <span className="mr-2 inline-flex"><LinkKindIcon kind={block.kind} className="size-7 rounded-md" /></span> : null}{block.label}</a>
        );
        if (block.type === "contact") return (
          <section key={block.id} className="flex flex-col gap-1">
            {block.phone ? <a href={telHref(block.phone)} className={rowClass}>{block.phone}</a> : null}
            {block.email ? <a href={`mailto:${block.email}`} className={rowClass}>{block.email}</a> : null}
            {block.website ? <a href={block.website} target="_blank" rel="noopener noreferrer" className={rowClass}>{block.website}</a> : null}
            {block.location ? <p className="break-words text-[#74736F]">{block.location}</p> : null}
            {block.saveContact ? (visitorActions
              ? <a href={visitorActions.saveContactHref} className={`${actionClass} mt-2`} style={{ borderColor: "var(--accent)" }}>Save contact</a>
              : <button disabled className="min-h-11 rounded-lg border px-4 font-medium disabled:opacity-50">Save contact</button>) : null}
          </section>
        );
        if (visitorActions) return <PublicForm key={block.id} formId={block.formId} title={block.title} fields={block.fields} />;
        return (
          <section key={block.id} className="flex flex-col gap-3 rounded-lg border p-4">
            <h2 className="break-words font-medium">{block.title}</h2>
            {block.fields.map(field => (
              <label key={field.key} className="flex flex-col gap-1 text-sm">
                {field.label}{field.required ? " (required)" : ""}
                {field.kind === "long" ? <Textarea disabled /> : <Input disabled type={field.kind} />}
              </label>
            ))}
            <button disabled className="min-h-11 rounded-lg border px-4 font-medium disabled:opacity-50">Send</button>
            <p className="text-sm text-muted-foreground">Visitors can send you a message here.</p>
          </section>
        );
      })}
    </article>
  );
}
