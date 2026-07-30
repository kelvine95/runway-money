const cad0 = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  maximumFractionDigits: 0,
});
const cad2 = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function money(v: number): string {
  return Math.abs(v) >= 1000 ? cad0.format(v) : cad2.format(v);
}

export function money0(v: number): string {
  return cad0.format(v);
}

export function pct(v: number, digits = 0): string {
  return `${(v * 100).toFixed(digits)}%`;
}

export function num(v: number, digits = 1): string {
  return v.toFixed(digits);
}
