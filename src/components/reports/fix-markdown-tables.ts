// =============================================================
// Markdown table normalizer
// =============================================================
// Handles three common Claude output bugs:
//
// 1. **Missing GFM separator row.** A pipe-row block needs
//    `|---|---|---|` between header and data. Without it, GFM
//    falls through to inline rendering and you see pipe-soup.
//
// 2. **One-cell pseudo-tables.** Lines like `| iFactory |` are
//    not actually tables — they're stray attribution. We strip
//    the pipes and render as plain text.
//
// 3. **Tables broken across paragraphs.** Claude sometimes
//    interleaves prose between rows, fragmenting a logical
//    table into many tiny ones. We can't always re-merge these
//    safely (the prose between rows is meaningful), so we leave
//    them alone but ensure each fragment renders as a real table.
// =============================================================

const TABLE_ROW = /^\s*\|.*\|\s*$/;
const SEPARATOR_ROW = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/;

function countCells(line: string): number {
  const trimmed = line.trim().replace(/^\||\|$/g, "");
  if (!trimmed) return 1;
  const parts = trimmed.split(/(?<!\\)\|/);
  return Math.max(1, parts.length);
}

function makeSeparator(numCells: number): string {
  return "| " + Array(numCells).fill("---").join(" | ") + " |";
}

/**
 * Strip pipes from a single-cell pseudo-table row and return as
 * plain text. `| iFactory |` → `iFactory`.
 */
function stripPipes(line: string): string {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .trim();
}

export function fixMarkdownTables(markdown: string): string {
  const lines = markdown.split("\n");
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (TABLE_ROW.test(line)) {
      // Find the contiguous block of pipe-rows
      const blockStart = i;
      let j = i;
      while (j < lines.length && TABLE_ROW.test(lines[j])) j++;
      const blockSize = j - blockStart;

      const headerLine = lines[blockStart];
      const headerCells = countCells(headerLine);

      // CASE 1: Single row with only 1 cell — pseudo-table.
      // Convert to plain text (strips the surrounding pipes).
      if (blockSize === 1 && headerCells <= 1) {
        const stripped = stripPipes(headerLine);
        if (stripped) result.push(stripped);
        i = j;
        continue;
      }

      // CASE 2: Single row with 2+ cells — orphan row, not really
      // a table. Convert to bullet list with bold labels.
      // Example: `| | Gross margin | 29.8% | 30.3% |` becomes
      // a bullet with the cells separated by middots.
      if (blockSize === 1 && headerCells >= 2) {
        const cells = headerLine
          .trim()
          .replace(/^\||\|$/g, "")
          .split(/(?<!\\)\|/)
          .map((c) => c.trim())
          .filter((c) => c.length > 0);
        if (cells.length === 0) {
          // weird case, skip
        } else if (cells.length === 1) {
          result.push(cells[0]);
        } else {
          // First cell as bold label, rest separated by middots
          result.push(`- **${cells[0]}** — ${cells.slice(1).join(" · ")}`);
        }
        i = j;
        continue;
      }

      // CASE 3: Multi-row table — ensure separator row is present
      const secondLine = lines[blockStart + 1];
      result.push(headerLine);
      if (secondLine !== undefined && SEPARATOR_ROW.test(secondLine)) {
        // Already has separator
        for (let k = blockStart + 1; k < j; k++) result.push(lines[k]);
      } else {
        // Inject separator
        result.push(makeSeparator(headerCells));
        for (let k = blockStart + 1; k < j; k++) result.push(lines[k]);
      }

      i = j;
      continue;
    }

    result.push(line);
    i++;
  }

  return result.join("\n");
}
