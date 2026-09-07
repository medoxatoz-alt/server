// src/utils/variantStock.ts
//
// Shared stock-restoration logic used whenever an order is rejected,
// cancelled, or deleted. Extracted out of orders.ts, which previously had
// this same Promise.all(...FieldValue.increment...) block duplicated three
// times, once per status-changing route.

import { db } from '../firebase';
import { OrderItem } from '../types';
import { resolveEffectiveVariant, applyStockDelta } from './variantResolution';

// Every item restores through a small transaction: read the product fresh,
// resolve where its stock actually lives right now (resolveEffectiveVariant
// -- an explicit variantId, or an inferred single variant, or the flat
// field), and write the qty back there. A read is required even for items
// with no variantId, since "does this product currently have exactly one
// variant" can only be answered by looking, not by trusting an old
// FieldValue.increment shortcut against the flat field alone.
export async function restoreStock(items: OrderItem[]): Promise<void> {
  await Promise.all(items.map(async (item) => {
    const ref = db.collection('products').doc(String(item.productId));
    try {
      await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        if (!snap.exists) return;
        const data = snap.data()!;
        const target = resolveEffectiveVariant(data, item.variantId);
        if (!target) return; // the specific variant no longer exists -- nothing safe to restore to
        const update = applyStockDelta(data, target, item.qty);
        transaction.update(ref, update);
      });
    } catch {
      // Product may have been deleted since -- non-fatal, same as the
      // original per-item .catch(() => {}) behavior.
    }
  }));
}
