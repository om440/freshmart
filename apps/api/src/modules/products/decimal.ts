export function decimal(
  value: unknown,
  label: string,
  precision: number,
  scale: number,
  allowZero: boolean,
): string {
  if (
    !Number.isInteger(precision) ||
    !Number.isInteger(scale) ||
    precision < 1 ||
    scale < 0 ||
    scale > precision
  ) {
    throw new Error("Decimal precision and scale are invalid.");
  }
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error(`${label} must be a number.`);
  }
  const normalized = String(value).trim();
  const integerDigits = precision - scale;
  const integerPattern =
    integerDigits === 0 ? "0" : `[1-9]\\d{0,${integerDigits - 1}}`;
  const fractionalPattern = scale > 0 ? `(?:\\.\\d{1,${scale}})?` : "";
  const pattern = new RegExp(`^(?:0|${integerPattern})${fractionalPattern}$`);
  if (!pattern.test(normalized)) {
    throw new Error(
      `${label} must be a non-negative number with at most ${scale} decimal places.`,
    );
  }
  if (!allowZero && Number(normalized) <= 0) {
    throw new Error(`${label} must be greater than zero.`);
  }
  return normalized;
}
