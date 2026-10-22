import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";
import { expect, test } from "vitest";

const sourceRoot = resolve("src");
const sources = new Map<string, ts.SourceFile>();
function source(file: string) {
  if (!sources.has(file)) sources.set(file, ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true));
  return sources.get(file)!;
}
function directive(file: ts.SourceFile) {
  const first = file.statements[0];
  return first && ts.isExpressionStatement(first) && ts.isStringLiteral(first.expression) ? first.expression.text : undefined;
}
function runtimeImports(file: ts.SourceFile): string[] {
  if (directive(file) === "use server") return [];
  const specifiers: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      const onlyTypes = clause?.isTypeOnly || (!clause?.name && bindings && ts.isNamedImports(bindings) && bindings.elements.length > 0 && bindings.elements.every(binding => binding.isTypeOnly));
      if (!onlyTypes && ts.isStringLiteral(node.moduleSpecifier)) specifiers.push(node.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const onlyTypes = node.isTypeOnly || (node.exportClause && ts.isNamedExports(node.exportClause) && node.exportClause.elements.length > 0 && node.exportClause.elements.every(binding => binding.isTypeOnly));
      if (!onlyTypes && ts.isStringLiteral(node.moduleSpecifier)) specifiers.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const argument = node.arguments[0];
      expect(argument && ts.isStringLiteralLike(argument), "Non-literal dynamic import in " + file.fileName).toBe(true);
      specifiers.push((argument as ts.StringLiteralLike).text);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return specifiers;
}
function localImport(file: string, specifier: string) {
  if (!specifier.startsWith("@/") && !specifier.startsWith(".")) return null;
  const base = specifier.startsWith("@/") ? join(sourceRoot, specifier.slice(2)) : resolve(dirname(file), specifier);
  const match = [base, base + ".ts", base + ".tsx", join(base, "index.ts"), join(base, "index.tsx")].find(candidate => existsSync(candidate) && statSync(candidate).isFile());
  expect(match, "Unresolved runtime import " + specifier + " from " + file).toBeDefined();
  return match!;
}
const display = (file: string) => relative(sourceRoot, file).replaceAll("\\", "/");
function bareImportChains(root: string) {
  const queue = [{ file: root, chain: [display(root)] }];
  const visited = new Set<string>();
  const leaves: string[][] = [];
  for (let index = 0; index < queue.length; index++) {
    const { file, chain } = queue[index];
    if (visited.has(file)) continue;
    visited.add(file);
    for (const specifier of runtimeImports(source(file))) {
      const local = localImport(file, specifier);
      if (local) queue.push({ file: local, chain: [...chain, display(local)] });
      else leaves.push([...chain, specifier]);
    }
  }
  return leaves;
}
const roots = readdirSync(sourceRoot, { recursive: true, encoding: "utf8" }).filter(file => /\.tsx?$/.test(file)).map(file => join(sourceRoot, file)).filter(file => directive(source(file)) === "use client").sort();

test("discovers use-client roots", () => expect(roots.length).toBeGreaterThan(0));

test("the reusable profile renderer and all layouts stay safe for client previews", () => {
  const paths = bareImportChains(resolve("src/components/profile/profile-renderer.tsx"));
  expect(paths.filter(chain => chain.some(part => /^(server-only|zod(?:\/|$)|pg$|config\/env\.|db\/)/.test(part)))).toEqual([]);
});

test("follows runtime edges while excluding type-only imports and server action bodies", () => {
  const fixture = ts.createSourceFile("fixture.ts", `
    import type { Schema } from "type-clause";
    import { type Schema } from "type-specifier";
    import { type Schema, value } from "mixed-import";
    import Default, { type Schema } from "default-import";
    import * as namespace from "namespace-import";
    import "side-effect";
    import {} from "empty-import";
    export type { Schema } from "type-export";
    export { type Schema } from "type-export-specifier";
    export { type Schema, value } from "mixed-export";
    export * from "star-export";
    const lazy = import("dynamic-import");
  `, ts.ScriptTarget.Latest, true);
  expect(runtimeImports(fixture)).toEqual(["mixed-import", "default-import", "namespace-import", "side-effect", "empty-import", "mixed-export", "star-export", "dynamic-import"]);
  const action = ts.createSourceFile("action.ts", '"use server"; import { z } from "zod";', ts.ScriptTarget.Latest, true);
  expect(runtimeImports(action)).toEqual([]);
});

for (const root of roots) test(display(root) + " cannot reach runtime Zod", () => {
  const paths = bareImportChains(root).filter(chain => {
    const leaf = chain[chain.length - 1];
    return leaf === "zod" || leaf.startsWith("zod/");
  }).map(chain => chain.join(" -> "));
  expect(paths, "Runtime Zod import chains from " + display(root) + ":\n" + paths.join("\n")).toEqual([]);
});

test("setup draft overlay stays free of server and validation dependencies", () => {
  const paths = bareImportChains(resolve("src/app/(customer)/app/setup/[cardId]/setup-draft.ts"));
  expect(paths.filter(chain => chain.some(part => /^(server-only|zod(?:\/|$)|pg$|config\/env\.|db\/)/.test(part)))).toEqual([]);
});
