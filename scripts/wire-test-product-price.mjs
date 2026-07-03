#!/usr/bin/env node
// =============================================================
// Wire a $1 test-mode Stripe price onto the "Test Product ($1)" program
// =============================================================
// The affiliate money-test needs a buyable product. Migration 0024 seeds a
// "Test Product ($1)" program row but WITHOUT a Stripe price, so it never
// appears on /enroll (the checkout only lists programs that have a
// stripe_price_id). This script creates a real $1 one-time price in Stripe
// TEST mode and attaches it to that program so the end-to-end test can run.
//
// It is idempotent: re-running reuses an existing product/price and only
// creates what's missing.
//
// Usage:
//   node scripts/wire-test-product-price.mjs
//
//   # if the product/price is already set and you want to replace it:
//   node scripts/wire-test-product-price.mjs --force
//
//   # to run against LIVE keys (guarded off by default — you almost never
//   # want a $1 test product in live):
//   node scripts/wire-test-product-price.mjs --allow-live
//
// Reads STRIPE_SECRET_KEY (or STRIPE_API_KEY) and DATABASE_URL from
// .env.local or the environment. If DATABASE_URL isn't available locally, the
// script still creates the Stripe price and prints a ready-to-paste SQL
// UPDATE you can run in the Supabase SQL editor.
// =============================================================

import Stripe from "stripe";
import postgres from "postgres";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

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
const ALLOW_LIVE = args.includes("--allow-live");

// The program seeded by migration 0024.
const PROGRAM_SLUG = "test-product-1";
const PROGRAM_NAME = "Test Product ($1)";
const AMOUNT_CENTS = 100;

function fail(msg) {
  console.error(`\n✗ ${msg}\n`);
  process.exit(1);
}

// ---- Stripe key + mode ----------------------------------------------------
const stripeKey =
  process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY || null;
if (!stripeKey) {
  fail(
    "No Stripe key found. Set STRIPE_SECRET_KEY (or STRIPE_API_KEY) in\n" +
      "  .env.local, or run inline:\n" +
      "    STRIPE_SECRET_KEY='sk_test_...' node scripts/wire-test-product-price.mjs",
  );
}
const mode = stripeKey.includes("_test_")
  ? "test"
  : stripeKey.includes("_live_")
    ? "live"
    : "unknown";
if (mode === "live" && !ALLOW_LIVE) {
  fail(
    "That's a LIVE Stripe key. Creating a $1 test product in live mode is\n" +
      "  almost never what you want. Re-run with --allow-live if you're sure.",
  );
}
console.log(`→ Stripe mode: ${mode.toUpperCase()}`);

const stripe = new Stripe(stripeKey);
const dbUrl = process.env.DATABASE_URL || null;
const sql = dbUrl ? postgres(dbUrl, { prepare: false, max: 1 }) : null;

async function main() {
  // ---- 1. Look at the current program row (if we have a DB) --------------
  let existing = null;
  if (sql) {
    const rows = await sql`
      SELECT id, name, stripe_product_id, stripe_price_id, active, archived_at
      FROM partner_programs
      WHERE slug = ${PROGRAM_SLUG}
      LIMIT 1
    `;
    if (rows.length === 0) {
      fail(
        `No program with slug "${PROGRAM_SLUG}" found. Run migration 0024 first.`,
      );
    }
    existing = rows[0];
    console.log(
      `→ Found program: ${existing.name} (${existing.id})` +
        `${existing.stripe_price_id ? ` — price already set: ${existing.stripe_price_id}` : ""}`,
    );

    // Already wired? Verify the price still resolves in THIS mode.
    if (existing.stripe_price_id && !FORCE) {
      try {
        const price = await stripe.prices.retrieve(existing.stripe_price_id);
        if (price && price.active) {
          console.log(
            `\n✓ Already wired — ${existing.stripe_price_id} is a valid ${mode} price.` +
              `\n  Nothing to do. Re-run with --force to replace it.\n`,
          );
          return;
        }
      } catch {
        console.log(
          "→ Existing price id doesn't resolve in this mode; creating a fresh one.",
        );
      }
    }
  } else {
    console.log(
      "→ No DATABASE_URL — will create the Stripe price and print the SQL to run.",
    );
  }

  // ---- 2. Ensure a Stripe product ----------------------------------------
  let productId = existing?.stripe_product_id || null;
  if (productId) {
    try {
      const p = await stripe.products.retrieve(productId);
      if (!p || p.deleted) productId = null;
    } catch {
      productId = null; // belongs to the other mode — recreate
    }
  }
  if (!productId) {
    const product = await stripe.products.create({
      name: PROGRAM_NAME,
      metadata: { caio_program_slug: PROGRAM_SLUG, caio_purpose: "test" },
    });
    productId = product.id;
    console.log(`→ Created Stripe product: ${productId}`);
  } else {
    console.log(`→ Reusing Stripe product: ${productId}`);
  }

  // ---- 3. Ensure a $1 one-time price -------------------------------------
  // Reuse an existing active $1 one-time price on the product if present.
  let priceId = null;
  for await (const price of stripe.prices.list({ product: productId, active: true, limit: 100 })) {
    if (
      price.active &&
      price.currency === "usd" &&
      price.unit_amount === AMOUNT_CENTS &&
      !price.recurring
    ) {
      priceId = price.id;
      break;
    }
  }
  if (priceId) {
    console.log(`→ Reusing existing $1 price: ${priceId}`);
  } else {
    const price = await stripe.prices.create({
      product: productId,
      currency: "usd",
      unit_amount: AMOUNT_CENTS,
      // one-time (mode:"payment" checkout) — no `recurring`
      metadata: { caio_program_slug: PROGRAM_SLUG, caio_purpose: "test" },
    });
    priceId = price.id;
    console.log(`→ Created $1 one-time price: ${priceId}`);
  }

  // ---- 4. Attach to the program row --------------------------------------
  if (sql) {
    await sql`
      UPDATE partner_programs
      SET stripe_product_id = ${productId},
          stripe_price_id   = ${priceId},
          active            = true,
          archived_at       = NULL,
          updated_at        = now()
      WHERE slug = ${PROGRAM_SLUG}
    `;
    console.log(
      `\n✓ Done. "${PROGRAM_NAME}" is now buyable in ${mode} mode.` +
        `\n  It will appear on /enroll and the money-test can run.\n`,
    );
  } else {
    console.log(
      `\n✓ Stripe price created. Run this in the Supabase SQL editor to finish:\n\n` +
        `  UPDATE partner_programs\n` +
        `  SET stripe_product_id = '${productId}',\n` +
        `      stripe_price_id   = '${priceId}',\n` +
        `      active = true, archived_at = NULL, updated_at = now()\n` +
        `  WHERE slug = '${PROGRAM_SLUG}';\n`,
    );
  }
}

try {
  await main();
} catch (err) {
  fail(err instanceof Error ? err.message : String(err));
} finally {
  if (sql) await sql.end();
}
