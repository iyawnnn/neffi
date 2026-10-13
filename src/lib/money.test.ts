import { expect, test } from "vitest";
import { formatPeso, parsePesos } from "./money";

test.each([["1", 100], [" 1,500.50 ", 150050], ["0.01", 1], ["10,000,000.00", 1000000000]])("parses %s as centavos", (input, expected) => {
  expect(parsePesos(input)).toBe(expected);
});

test.each(["0", "0.00", "-1", "1.001", "10000000.01", "1e3", "NaN", "", "1,50", "12,34,567", "1 000", ".50"])("rejects invalid pesos %s", (input) => {
  expect(() => parsePesos(input)).toThrow(RangeError);
});

test("formats centavos without rounding away the cents", () => {
  expect(formatPeso(150050)).toBe("₱1,500.50");
  expect(formatPeso(0)).toBe("₱0.00");
  expect(formatPeso(-1)).toBe("-₱0.01");
});
