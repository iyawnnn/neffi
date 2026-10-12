import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import { buttonVariants } from "@/components/ui/button";

// Opening tags of a JSX element, tolerant of `=>` and nested braces inside attributes.
export function openingTags(source: string, name: string): string[] {
  const tags: string[] = [];
  for (let i = source.indexOf(`<${name}`); i !== -1; i = source.indexOf(`<${name}`, i + 1)) {
    if (!/[\s/>]/.test(source[i + name.length + 1] ?? "")) continue;
    let depth = 0;
    let j = i;
    for (; j < source.length; j++) {
      if (source[j] === "{") depth++;
      else if (source[j] === "}") depth--;
      else if (source[j] === ">" && depth === 0) break;
    }
    tags.push(source.slice(i, j + 1));
  }
  return tags;
}

const TALL = /size="touch"|\bh-11\b|\bmin-h-11\b|\bsize-11\b/;
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
const files = ["src/app/(customer)", "src/app/(public)/c"].flatMap(walk).filter((file) => file.endsWith(".tsx") && !file.endsWith(".test.tsx"));

test("the touch size is 44px", () => {
  expect(buttonVariants({ size: "touch" })).toContain("h-11");
});

test("the tag scanner sees through arrow functions", () => {
  expect(openingTags('<Button onClick={() => go()} className="h-8">Go</Button>', "Button")).toEqual([
    '<Button onClick={() => go()} className="h-8">',
  ]);
});

test.each(files)("%s: every Button and Link is at least 44px tall", (file) => {
  const source = readFileSync(file, "utf8");
  for (const tag of [...openingTags(source, "Button"), ...openingTags(source, "Link")]) expect(tag, file).toMatch(TALL);
});
