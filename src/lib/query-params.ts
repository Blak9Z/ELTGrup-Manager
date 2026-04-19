export function parsePositiveIntParam(
  value: string | null | undefined,
  options?: { fallback?: number; min?: number },
) {
  const fallback = options?.fallback ?? 1;
  const min = options?.min ?? 1;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min) return fallback;
  return parsed;
}

export function parseEnumParam<T extends string>(value: string | null | undefined, allowed: readonly T[]) {
  if (!value) return undefined;
  return allowed.includes(value as T) ? (value as T) : undefined;
}

export function parseDateParam(value: string | null | undefined) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}
