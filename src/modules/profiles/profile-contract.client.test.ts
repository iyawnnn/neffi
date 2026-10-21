import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import ts from "typescript";
import { expect, test } from "vitest";

const root = resolve("src");
const files = ["src/modules/profiles/profile-sections.ts", "src/modules/profiles/profile-theme.ts"];
const source = (file: string) => ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
const directive = (file: ts.SourceFile) => {
  const statement = file.statements[0];
  return statement && ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression) ? statement.expression.text : undefined;
};
function runtimeImports(file: ts.SourceFile) {
  const imports: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node)) {
      const bindings = node.importClause?.namedBindings;
      const typeOnly = node.importClause?.isTypeOnly || (!node.importClause?.name && bindings && ts.isNamedImports(bindings) && bindings.elements.length > 0 && bindings.elements.every((binding) => binding.isTypeOnly));
      if (!typeOnly && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const typeOnly = node.isTypeOnly || (node.exportClause && ts.isNamedExports(node.exportClause) && node.exportClause.elements.length > 0 && node.exportClause.elements.every((binding) => binding.isTypeOnly));
      if (!typeOnly && ts.isStringLiteral(node.moduleSpecifier)) imports.push(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || node.expression.getText() === "require")) {
      imports.push("<dynamic import or require>");
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return imports;
}
function local(file: string, specifier: string) {
  if (!specifier.startsWith(".")) return null;
  const base = resolve(dirname(file), specifier);
  return [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")].find((candidate) => existsSync(candidate) && statSync(candidate).isFile()) ?? null;
}

test.each(files)("%s stays client-safe across its runtime graph", (entry) => {
  expect(existsSync(entry), `missing client contract module: ${entry}`).toBe(true);
  const queue = [resolve(entry)];
  const visited = new Set<string>();
  const violations: string[] = [];
  while (queue.length) {
    const file = queue.shift()!;
    if (visited.has(file)) continue;
    visited.add(file);
    const ast = source(file);
    expect(directive(ast)).not.toBe("use server");
    for (const specifier of runtimeImports(ast)) {
      const next = local(file, specifier);
      if (next) {
        const display = relative(root, next).replaceAll("\\", "/");
        expect(display.startsWith("db/") || display.startsWith("config/") || display === "modules/db.ts", `forbidden client boundary import: ${display}`).toBe(false);
        queue.push(next);
      }
      else violations.push(`${relative(root, file)} -> ${specifier}`);
    }
  }
  expect(violations).toEqual([]);
});
