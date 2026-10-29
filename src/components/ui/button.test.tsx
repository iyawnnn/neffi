// @vitest-environment happy-dom
import { ArrowRight } from "lucide-react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, test } from "vitest";
import { Button } from "./button";

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
});

function actionButton(loading: boolean) {
  return (
    <Button loading={loading} loadingText="Checking…" variant="action">
      Continue <ArrowRight aria-hidden />
    </Button>
  );
}

test("loadable buttons reserve centered idle and pending content layers", async () => {
  await act(async () => root.render(actionButton(false)));

  const button = host.querySelector<HTMLButtonElement>("[data-slot=button]")!;
  const layers = button.firstElementChild!.children;
  expect(layers).toHaveLength(2);
  expect(layers[0].className).toContain("inline-flex");
  expect(layers[0].className).toContain("gap-[inherit]");
  expect(layers[1].className).toContain("inline-flex");
  expect(layers[1].className).toContain("invisible");
  expect(layers[1].getAttribute("aria-hidden")).toBe("true");
  expect(button.disabled).toBe(false);
  expect(button.getAttribute("aria-busy")).toBeNull();

  await act(async () => root.render(actionButton(true)));

  expect(button.disabled).toBe(true);
  expect(button.getAttribute("aria-busy")).toBe("true");
  expect(layers[0].className).toContain("invisible");
  expect(layers[0].getAttribute("aria-hidden")).toBe("true");
  expect(layers[1].className).not.toContain("invisible");
  expect(layers[1].getAttribute("aria-hidden")).toBeNull();
  expect(layers[1].textContent).toBe("Checking…");
  expect(layers[1].querySelector("svg")).not.toBeNull();
});

test("ordinary buttons keep their direct child content", async () => {
  await act(async () => root.render(<Button><span data-child>Platform tile</span></Button>));

  const button = host.querySelector<HTMLButtonElement>("[data-slot=button]")!;
  expect(button.querySelector("[data-child]")?.parentElement).toBe(button);
  expect(button.querySelector(".inline-grid")).toBeNull();
});
