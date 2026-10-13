/** Word-level diff (LCS) for the grammar preview. Whitespace tokens are kept so text re-joins exactly. */
export type DiffPart = { text: string; type: 'same' | 'added' | 'removed' };

const tokenize = (s: string): string[] => s.match(/\s+|[^\s]+/g) ?? [];

/** Returns null when inputs are too large to diff cheaply on a phone (caller shows plain text). */
export function wordDiff(before: string, after: string, maxCells = 1_500_000): DiffPart[] | null {
  const a = tokenize(before);
  const b = tokenize(after);
  if (a.length * b.length > maxCells) return null;

  const n = a.length;
  const m = b.length;
  const lcs: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const out: DiffPart[] = [];
  const push = (text: string, type: DiffPart['type']) => {
    const last = out[out.length - 1];
    if (last && last.type === type) last.text += text;
    else out.push({ text, type });
  };
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push(a[i], 'same');
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      push(a[i++], 'removed');
    } else {
      push(b[j++], 'added');
    }
  }
  while (i < n) push(a[i++], 'removed');
  while (j < m) push(b[j++], 'added');
  return out;
}
