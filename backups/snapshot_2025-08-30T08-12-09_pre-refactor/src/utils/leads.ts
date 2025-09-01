import { Customer } from "@/types/customer";

// Helper: pick the earliest known date relevant for "first contact" style ordering.
// Priority order: dateAdded -> firstCallDate -> secondCallDate -> finalCallDate.
function primaryChronoDate(c: Customer): string | undefined {
  return (
    c.dateAdded ||
    c.firstCallDate ||
    c.secondCallDate ||
    c.finalCallDate ||
    undefined
  );
}

// Normalize YYYY-MM-DD validity.
function validYMD(d?: string) {
  return !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);
}

// Compute lead numbers: earliest chronological date (per primaryChronoDate) gets #1.
// If both invalid / missing, they are grouped after all valid-dated leads preserving original insertion order.
// Stable tie-breaker: id (so numbering doesn't flicker if same date).
export function computeLeadNumbers(data: Customer[]): Record<string, number> {
  const withIdx = data.map((c, i) => ({ c, i }));
  // Earliest chronological date first so #1 = earliest lead.
  withIdx.sort((a, b) => {
    const da = primaryChronoDate(a.c);
    const db = primaryChronoDate(b.c);
    const va = validYMD(da);
    const vb = validYMD(db);
    if (va && vb) {
      if (da === db) return a.c.id.localeCompare(b.c.id);
      return da!.localeCompare(db!); // ascending
    }
    if (va && !vb) return -1;
    if (!va && vb) return 1;
    return a.i - b.i;
  });
  const map: Record<string, number> = {};
  withIdx.forEach(({ c }, i) => {
    map[c.id] = i + 1;
  });
  return map;
}
