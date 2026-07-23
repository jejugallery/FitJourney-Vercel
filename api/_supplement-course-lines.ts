export function getUniqueSupplementIds(lines: Array<{ supplementId?: unknown }>): string[] {
  return [...new Set(lines.map(line => String(line.supplementId || '')))];
}
