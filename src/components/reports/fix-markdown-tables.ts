// =============================================================
// Markdown table normalizer
// =============================================================
// remark-gfm requires GitHub-flavored Markdown tables to have:
//   1. A header row (first row of cells)
//   2. A separator row immediately after (e.g. |---|---|---|)
//   3. Data rows
//
// Claude sometimes outputs "tables" that are missing the separator
// row, producing pipe-soup that renders as inline text. This
// helper detects sequences of pipe-rows and injects the missing
// separator so they render as actual tables.
// =============================================================

const TABLE_ROW = /^\s*\|.*\|\s*$/;
const SEPARATOR_ROW = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/;

function countCells(line: string): number {
  // Count pipes that aren't escaped, then subtract 1 for outer pipes.
  // Tolerant: returns at least 1.
  const trimmed = line.trim().replace(/^\||\|$/g, "");
  if (!trimmed) return 1;
  // Split on unescaped pipes
  const parts = trimmed.split(/(?<!\\)\|/);
  return Math.max(1, parts.length);
}

function makeSeparator(numCells: number): string {
  return "| " + Array(numCells).fill("---").join(" | ") + " |";
}

/**
 * Normalize markdown so that pipe-style tables always render correctly.
 * - Detects contiguous blocks of lines that look like table rows.
 * - If the second line of a block isn't a separator, inserts one
 *   based on the first row's cell count.
 * - Leaves already-correct tables untouched.
 */
export function fixMarkdownTables(markdown: string): string {
  const lines = markdown.split("\n");
  const result: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (TABLE_ROW.test(line)) {
      // Found the start of what looks like a table block
      const blockStart = i;
      let j = i;
      while (j < lines.length && TABLE_ROW.test(lines[j])) j++;
      // lines[blockStart..j-1] are the contiguous pipe rows

      const headerLine = lines[blockStart];
      const secondLine = lines[blockStart + 1];

      result.push(headerLine);

      if (
        blockStart + 1 < j &&
        secondLine !== undefined &&
        SEPARATOR_ROW.test(secondLine)
      ) {
        // Already has separator — leave untouched, push the rest as-is
        for (let k = blockStart + 1; k < j; k++) result.push(lines[k]);
      } else if (j - blockStart >= 2) {
        // Two or more rows, no separator — inject one after the header
        const cells = countCells(headerLine);
        result.push(makeSeparator(cells));
        for (let k = blockStart + 1; k < j; k++) result.push(lines[k]);
      } else {
        // Single pipe-row, not really a table — push and move on
        // (already pushed above)
      }

      i = j;
      continue;
    }

    result.push(line);
    i++;
  }

  return result.join("\n");
}
