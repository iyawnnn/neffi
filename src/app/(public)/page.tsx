import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Neffi</h1>
      <p className="text-muted-foreground">Tap to share who you are.</p>
      <Button disabled>Card activation opens soon</Button>
    </main>
  );
}
