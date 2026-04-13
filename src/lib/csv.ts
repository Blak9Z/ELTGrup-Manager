function sanitizeForSpreadsheet(value: string) {
  // Prevent formula injection when opening CSV files in spreadsheet apps.
  if (/^[=+\-@\t\r]/.test(value)) return `'${value}`;
  return value;
}

function escapeCsvValue(value: unknown) {
  const normalized = sanitizeForSpreadsheet(value == null ? "" : String(value));
  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replace(/"/g, "\"\"")}"`;
  }
  return normalized;
}

export function toCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return "";

  const headers = Object.keys(rows[0]);
  const lines = [headers.map(escapeCsvValue).join(",")];

  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsvValue(row[header])).join(","));
  }

  // BOM keeps Romanian diacritics readable in Excel.
  return `\uFEFF${lines.join("\n")}`;
}
