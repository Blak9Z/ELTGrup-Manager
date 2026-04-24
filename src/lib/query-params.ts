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

export function resolvePagination({
  page,
  totalItems,
  pageSize,
}: {
  page: number;
  totalItems: number;
  pageSize: number;
}) {
  const safePageSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(Math.max(0, totalItems) / safePageSize));
  const currentPage = Math.min(page, totalPages);

  return {
    totalPages,
    currentPage,
    skip: (currentPage - 1) * safePageSize,
    take: safePageSize,
  };
}

type ListHrefParamValue = string | number | null | undefined;

export function buildListHref(
  basePath: `/${string}`,
  params: Record<string, ListHrefParamValue>,
) {
  const searchParams = new URLSearchParams();

  for (const [key, rawValue] of Object.entries(params)) {
    if (rawValue === null || rawValue === undefined) continue;
    const value = String(rawValue).trim();
    if (!value) continue;
    if (key === "page" && value === "1") continue;
    searchParams.set(key, value);
  }

  const search = searchParams.toString();
  return search ? `${basePath}?${search}` : basePath;
}
