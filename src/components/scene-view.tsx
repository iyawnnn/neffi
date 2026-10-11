import type { CSSProperties } from "react";
import { Input, Textarea } from "@/components/ui/input";
import type { SceneView } from "@/modules/profiles/scene-view";

const linkClass = "inline-flex min-h-11 w-full items-center justify-center rounded-lg border-2 px-4 font-medium";

export function SceneViewPreview({ view }: { view: SceneView }) {
  const { identity } = view;
  return (
    <article style={{ "--accent": identity.accent } as CSSProperties} className="mx-auto flex w-full max-w-[390px] flex-col gap-4 rounded-2xl border bg-background p-5">
      <header className="flex flex-col items-center gap-2 text-center">
        {identity.image ? (
          <img src={identity.image.url} alt="" width={96} height={96} className={`size-24 ${identity.image.isLogo ? "object-contain" : "rounded-full object-cover"}`} />
        ) : (
          <div className="flex size-24 items-center justify-center rounded-full text-2xl font-semibold text-white" style={{ background: "var(--accent)" }}>{identity.initials}</div>
        )}
        <h1 className="break-words text-2xl font-semibold">{identity.fullName}</h1>
        {identity.headline ? <p className="break-words">{identity.headline}</p> : null}
        {identity.company ? <p className="break-words text-sm text-muted-foreground">{identity.company}</p> : null}
        {identity.location ? <p className="break-words text-sm text-muted-foreground">{identity.location}</p> : null}
      </header>
      {view.blocks.map(block => {
        if (block.type === "about") return <p key={block.id} className="whitespace-pre-line break-words">{block.text}</p>;
        if (block.type === "project") return (
          <section key={block.id} className="flex flex-col gap-2 rounded-lg border p-4">
            <h2 className="break-words font-medium">{block.title}</h2>
            {block.description ? <p className="whitespace-pre-line break-words text-sm">{block.description}</p> : null}
            {block.url ? <a href={block.url} target="_blank" rel="noopener noreferrer" className={linkClass} style={{ borderColor: "var(--accent)" }}>View project</a> : null}
          </section>
        );
        if (block.type === "link" || block.type === "booking") return (
          <a key={block.id} href={block.url} target="_blank" rel="noopener noreferrer" className={linkClass} style={block.type === "booking" ? { background: "var(--accent)", color: "#fff", borderColor: "var(--accent)" } : { borderColor: "var(--accent)" }}>{block.label}</a>
        );
        if (block.type === "contact") return (
          <section key={block.id} className="flex flex-col gap-2">
            {block.phone ? <a href={`tel:${block.phone}`} className="inline-flex min-h-11 items-center break-all">{block.phone}</a> : null}
            {block.email ? <a href={`mailto:${block.email}`} className="inline-flex min-h-11 items-center break-all">{block.email}</a> : null}
            {block.website ? <a href={block.website} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center break-all">{block.website}</a> : null}
            {block.location ? <p className="break-words">{block.location}</p> : null}
            {block.saveContact ? <button disabled className="min-h-11 rounded-lg border px-4 font-medium disabled:opacity-50">Save contact</button> : null}
          </section>
        );
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
