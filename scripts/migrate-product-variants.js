// One-off: backfills a `variants` array onto every product doc that doesn't
// already have one, built from that doc's CURRENT flat price/mrp/stock/images.
//
// Why: the admin/vendor product form now only edits price/mrp/stock/images
// through `variants` (see products.ts's normaliseVariants/applyVariantAggregate).
// Existing products still only have the old flat fields. This script moves
// them onto the same shape by wrapping their current values in a single
// variant, so they keep selling exactly as before -- it does NOT change any
// existing field's value, it only ADDS `variants`, whose aggregate (see
// applyVariantAggregate) comes out identical to what's already stored.
//
// Idempotent and safe to re-run: skips any doc that already has a non-empty
// `variants` array. Dry-run by default -- pass --apply to actually write.
//
// Usage:
//   node scripts/migrate-product-variants.js           (dry run, prints what would change)
//   node scripts/migrate-product-variants.js --apply    (writes for real)

require('dotenv').config();
const admin = require('firebase-admin');
const crypto = require('crypto');

const { FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, FIREBASE_ADMIN_PRIVATE_KEY } = process.env;

if (!FIREBASE_ADMIN_PROJECT_ID || !FIREBASE_ADMIN_CLIENT_EMAIL || !FIREBASE_ADMIN_PRIVATE_KEY) {
  console.error('Missing FIREBASE_ADMIN_* credentials in .env');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});

const db = admin.firestore();
const APPLY = process.argv.includes('--apply');
const BATCH_SIZE = 400; // Firestore batch write cap is 500

function parseImages(imageProp) {
  if (Array.isArray(imageProp)) {
    return imageProp.filter((x) => typeof x === 'string' && x.trim() !== '');
  }
  if (typeof imageProp !== 'string') return [];
  const trimmed = imageProp.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === 'string' && x.trim() !== '');
    } catch {
      // fall through to comma/single-string handling below
    }
  }
  if (trimmed.includes(',')) return trimmed.split(',').map((s) => s.trim()).filter(Boolean);
  return [trimmed];
}

function toNumber(val) {
  if (val === undefined || val === null || val === '') return undefined;
  const n = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : Number(val);
  return Number.isFinite(n) ? n : undefined;
}

(async () => {
  const snap = await db.collection('products').get();
  console.log(`Scanning ${snap.size} product(s)...`);

  const toMigrate = [];
  let alreadyMigrated = 0;

  for (const doc of snap.docs) {
    const p = doc.data();
    if (Array.isArray(p.variants) && p.variants.length > 0) {
      alreadyMigrated++;
      continue;
    }

    const images = Array.isArray(p.images) && p.images.length > 0 ? p.images : parseImages(p.image);
    const price = toNumber(p.price) || 0;
    const mrp = toNumber(p.mrp);
    const stock = Number(p.stock) || 0;

    const variant = {
      id: crypto.randomUUID(),
      label: '',
      price,
      mrp,
      stock,
      images,
    };
    toMigrate.push({ id: doc.id, title: p.title || '(untitled)', variant });
  }

  console.log(`Already migrated: ${alreadyMigrated}`);
  console.log(`Need migration:   ${toMigrate.length}`);

  if (!APPLY) {
    console.log('\nDry run -- no writes made. Pass --apply to write for real.');
    console.log('Sample of what would be written (first 5):');
    console.log(JSON.stringify(toMigrate.slice(0, 5), null, 2));
    return;
  }

  if (toMigrate.length === 0) {
    console.log('Nothing to migrate.');
    return;
  }

  let committed = 0;
  for (let i = 0; i < toMigrate.length; i += BATCH_SIZE) {
    const chunk = toMigrate.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const item of chunk) {
      batch.update(db.collection('products').doc(item.id), { variants: [item.variant] });
    }
    await batch.commit();
    committed += chunk.length;
    console.log(`Committed ${committed}/${toMigrate.length}`);
  }

  console.log('Done.');
})().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
