#!/usr/bin/env node
// =============================================================
// Upload the #affiliate-files kit into the portal "Resources" system
// =============================================================
// The affiliate Resources page is admin-upload-driven: it lists rows from
// the `partner_resources` table (public, non-archived) grouped by category.
// The finished kit lives in the repo-root "#affiliate-files" folder but was
// never uploaded, so the page is empty. This script uploads each file to the
// PUBLIC Vercel Blob store (the same put() the admin UI uses) and inserts a
// matching partner_resources row.
//
// Idempotent: skips any file whose title already has a live (non-archived)
// row, so re-running won't duplicate. Use --force to upload again anyway.
//
// Usage:
//   node scripts/upload-affiliate-resources.mjs
//   node scripts/upload-affiliate-resources.mjs --dry-run   # show plan, no writes
//   node scripts/upload-affiliate-resources.mjs --force     # upload even if title exists
//
// Reads DATABASE_URL and BLOB_READ_WRITE_TOKEN (the PUBLIC "affiliates-system"
// store — NOT the private TAX_ token) from .env.local or the environment.
// =============================================================

import { put, del } from "@vercel/blob";
import postgres from "postgres";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

// ---- Lazy .env.local loader (no dotenv dependency) ------------------------
function loadEnv() {
  const p = resolve(projectRoot, ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
}
loadEnv();

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const DRY_RUN = args.includes("--dry-run");

function fail(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

const RESOURCES_DIR = join(projectRoot, "#affiliate-files");
if (!existsSync(RESOURCES_DIR)) {
  fail(`Resources folder not found: ${RESOURCES_DIR}`);
}

// category must be one of the seven the portal renders; anything else is
// stored but silently hidden on the affiliate page:
//   playbook | toolkit | brand_asset | email_template | social_post | banner | other
const ITEMS = [
  {
    file: "CAIO Partner Playbook.pdf",
    category: "playbook",
    title: "CAIO Partner Playbook",
    mime: "application/pdf",
    description:
      "The complete affiliate playbook — program overview, positioning, commissions, and how to promote CAIO.",
    isPublic: true,
    sortOrder: 0,
  },
  {
    file: "Marketing Toolkit.dc.html",
    category: "toolkit",
    title: "CAIO Marketing Toolkit",
    mime: "text/html; charset=utf-8",
    description:
      "Ready-to-use marketing copy, messaging, and promotional assets for CAIO affiliates.",
    isPublic: true,
    sortOrder: 0,
  },
  {
    file: "06.12.2026 CAIO_Partners_Landing_Page_Copy.docx",
    category: "toolkit",
    title: "Partner Landing Page Copy",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    description:
      "Editable landing-page copy affiliates can adapt for their own site or campaign.",
    isPublic: true,
    sortOrder: 1,
  },
  {
    file: "06.2026 CAIO_Partner_Program_Launch_Emails.docx",
    category: "email_template",
    title: "Partner Launch Email Templates",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    description:
      "Pre-written launch/announcement emails to introduce CAIO to your audience.",
    isPublic: true,
    sortOrder: 0,
  },
  {
    file: "06.2026 CAIO_Partner_Program_Terms.docx",
    category: "other",
    title: "Partner Program Terms",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    description: "Official terms and conditions of the CAIO affiliate/partner program.",
    isPublic: true,
    sortOrder: 0,
  },
  // Editable source files that duplicate the polished deliverables above are
  // intentionally NOT uploaded (the PDF + rendered HTML are the affiliate-facing
  // versions). Uncomment to expose them; note the blob store is public regardless
  // of isPublic (isPublic:false only hides the row from the listing).
  // {
  //   file: "06.2026 April_CAIO_Partner_Playbook.docx",
  //   category: "playbook", title: "Partner Playbook (editable source)",
  //   mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  //   description: "Editable Word source of the Partner Playbook.",
  //   isPublic: false, sortOrder: 9,
  // },
  // {
  //   file: "06.12.2026 CAIO_Partner_Marketing_Toolkit.docx",
  //   category: "toolkit", title: "Marketing Toolkit (editable source)",
  //   mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  //   description: "Editable Word source of the Marketing Toolkit.",
  //   isPublic: false, sortOrder: 9,
  // },
];

// ---- Preflight ------------------------------------------------------------
for (const it of ITEMS) {
  if (!existsSync(join(RESOURCES_DIR, it.file))) {
    fail(`Missing file listed in ITEMS: ${it.file}`);
  }
}

if (DRY_RUN) {
  console.log("→ DRY RUN — plan (no uploads, no DB writes):\n");
  for (const it of ITEMS) {
    const bytes = readFileSync(join(RESOURCES_DIR, it.file)).byteLength;
    console.log(
      `  • "${it.title}"  [${it.category}]  ${it.isPublic ? "public" : "hidden"}  ${(bytes / 1024).toFixed(0)}KB  (${it.file})`,
    );
  }
  console.log("\n  Re-run without --dry-run to upload.\n");
  process.exit(0);
}

const dbUrl = process.env.DATABASE_URL || null;
if (!dbUrl || !process.env.BLOB_READ_WRITE_TOKEN) {
  fail(
    "This script needs two secrets from your Vercel project:\n" +
      "    DATABASE_URL           (Postgres connection string)\n" +
      "    BLOB_READ_WRITE_TOKEN  (the PUBLIC blob store — NOT the TAX_ token)\n\n" +
      "  Easiest: create a file named  .env.local  in the project root (it is\n" +
      "  gitignored) with these two lines, then re-run this script:\n" +
      "    DATABASE_URL=postgresql://...\n" +
      "    BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...\n\n" +
      "  Both values are in Vercel → your project → Settings → Environment Variables.\n" +
      "  (One-off in PowerShell instead:  $env:DATABASE_URL='...'; $env:BLOB_READ_WRITE_TOKEN='...'; node scripts/upload-affiliate-resources.mjs )",
  );
}

const sql = postgres(dbUrl, { prepare: false, max: 1 });

async function main() {
  let uploaded = 0;
  let skipped = 0;

  for (const it of ITEMS) {
    const existing = await sql`
      SELECT id FROM partner_resources
      WHERE title = ${it.title} AND archived_at IS NULL
    `;
    if (existing.length > 0) {
      if (!FORCE) {
        console.log(`→ Skip "${it.title}" — already uploaded (${existing[0].id}). Use --force to replace.`);
        skipped++;
        continue;
      }
      // --force: archive the existing live row(s) first so we don't leave two
      // live rows with the same title (the portal would render duplicate cards).
      await sql`
        UPDATE partner_resources SET archived_at = now()
        WHERE title = ${it.title} AND archived_at IS NULL
      `;
      console.log(`→ Archived ${existing.length} existing "${it.title}" row(s) (--force).`);
    }

    const buf = readFileSync(join(RESOURCES_DIR, it.file));
    // Mirror the admin route: public store, random suffix, timestamped path.
    const blob = await put(`partner-resources/${Date.now()}-${it.file}`, buf, {
      access: "public",
      addRandomSuffix: true,
      contentType: it.mime,
    });

    try {
      const [row] = await sql`
        INSERT INTO partner_resources
          (title, description, category, file_url, file_name, mime_type, size_bytes, is_public, sort_order)
        VALUES
          (${it.title}, ${it.description}, ${it.category}, ${blob.url}, ${it.file},
           ${it.mime}, ${buf.byteLength}, ${it.isPublic}, ${it.sortOrder})
        RETURNING id
      `;
      console.log(`✓ Uploaded "${it.title}"  →  ${row.id}`);
      uploaded++;
    } catch (err) {
      // Compensate: the DB row failed, so delete the blob we just uploaded
      // rather than orphaning a public file with no row pointing at it.
      try {
        await del(blob.url);
      } catch {
        // best-effort cleanup
      }
      throw err;
    }
  }

  console.log(`\n✓ Done. ${uploaded} uploaded, ${skipped} skipped.`);
  console.log("  They appear on the affiliate portal Resources page immediately.\n");
}

try {
  await main();
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
} finally {
  await sql.end();
}
