import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import ts from "typescript";
import { expect, test } from "vitest";

test("ProfileRenderer can be imported by client previews without server code or runtime Zod", () => {
  const queue = [resolve("src/components/profile/profile-renderer.tsx")];
  const visited = new Set<string>();
  while (queue.length) {
    const file = queue.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);
    expect(file.replaceAll("\\", "/")).not.toMatch(/\/(db|auth|config)\//);
    const text = readFileSync(file, "utf8");
    expect(text).not.toMatch(/["']use server["']/);
    const ast = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
    for (const node of ast.statements) {
      if (!ts.isImportDeclaration(node) && !ts.isExportDeclaration(node)) continue;
      if (!node.moduleSpecifier || !ts.isStringLiteral(node.moduleSpecifier)) continue;
      if (ts.isImportDeclaration(node)) {
        const clause = node.importClause;
        const bindings = clause?.namedBindings;
        if (clause?.isTypeOnly || (!clause?.name && bindings && ts.isNamedImports(bindings) && bindings.elements.every(b => b.isTypeOnly))) continue;
      } else if (node.isTypeOnly) continue;
      const specifier = node.moduleSpecifier.text;
      expect(specifier).not.toMatch(/^(server-only|zod|pg|drizzle-orm)(\/|$)/);
      if (!specifier.startsWith("@/") && !specifier.startsWith(".")) continue;
      if (specifier.endsWith(".css")) continue;
      const base = specifier.startsWith("@/") ? resolve("src", specifier.slice(2)) : resolve(dirname(file), specifier);
      const local = [`${base}.ts`, `${base}.tsx`].find(existsSync);
      expect(local, `${file}: ${specifier}`).toBeDefined();
      queue.push(local!);
    }
  }
  expect(visited).toContain(resolve("src/modules/profiles/profile-sections.ts"));
  expect(visited).toContain(resolve("src/modules/profiles/profile-theme.ts"));
});
