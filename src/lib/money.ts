export function parsePesos(input: string): number {
  const value = input.trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(value)) throw new RangeError("Enter a peso amount with at most two decimal places.");
  const [whole, fraction = ""] = value.replaceAll(",", "").split(".");
  const centavos = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(centavos) || centavos <= 0 || centavos > 1_000_000_000) throw new RangeError("Amount must be greater than zero and at most ₱10,000,000.");
  return centavos;
}

export function formatPeso(centavos: number): string {
  return pesoFormatter.format(centavos / 100);
}

const pesoFormatter = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });
