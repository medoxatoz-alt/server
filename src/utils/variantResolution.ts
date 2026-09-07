// src/utils/variantResolution.ts
//
// Single source of truth for "where does this cart/order item's price and
// stock actually live on the product doc" -- a plain flat field, or an entry
// inside `variants[]`. Used by cart.ts, payments.ts, and variantStock.ts so
// all three agree, instead of each re-deriving it slightly differently.
//
// An explicit variantId always resolves to that variant. With no variantId
// (only possible for cart/order items created before this feature existed),
// a product that currently has exactly one variant treats that variant AS
// its stock/price -- the common case once every product has been migrated
// to carry a variants array. Only a genuinely ambiguous legacy case (no
// variantId, but the product now has zero or 2+ variants) falls back to the
// flat field, which preserves the total inventory count rather than
// guessing which variant an old order line was really for.

export interface ResolvedVariantTarget {
  source: 'variant' | 'flat';
  index?: number; // into productData.variants, only when source === 'variant'
  price: number;
  stock: number;
  label?: string;
  images: string[];
}

function flatImages(productData: any): string[] {
  const field = productData.images || productData.image;
  if (Array.isArray(field)) return field.filter((s: any) => typeof s === 'string' && s.trim() !== '');
  if (typeof field === 'string' && field.trim() !== '') return [field];
  return [];
}

function flatPrice(productData: any): number {
  return typeof productData.price === 'string'
    ? parseFloat(productData.price.replace(/,/g, '')) || 0
    : Number(productData.price) || 0;
}

// Returns null only when an explicit variantId was given but doesn't exist
// on the product (caller should treat this as "product/variant not found").
export function resolveEffectiveVariant(productData: any, variantId?: string): ResolvedVariantTarget | null {
  const variants: any[] = Array.isArray(productData.variants) ? productData.variants : [];

  if (variantId) {
    const index = variants.findIndex(v => v.id === variantId);
    if (index === -1) return null;
    const v = variants[index];
    return {
      source: 'variant',
      index,
      price: Number(v.price) || 0,
      stock: Number(v.stock) || 0,
      label: v.label,
      images: Array.isArray(v.images) && v.images.length > 0 ? v.images : flatImages(productData),
    };
  }

  if (variants.length === 1) {
    const v = variants[0];
    return {
      source: 'variant',
      index: 0,
      price: Number(v.price) || 0,
      stock: Number(v.stock) || 0,
      label: v.label,
      images: Array.isArray(v.images) && v.images.length > 0 ? v.images : flatImages(productData),
    };
  }

  return {
    source: 'flat',
    price: flatPrice(productData),
    stock: Number(productData.stock) || 0,
    images: flatImages(productData),
  };
}

// Firestore update object for applying a stock change (+n to restore, -n to
// deduct) at the resolved target. For a variant target, the flat `stock`
// field is recomputed as the new sum in the same update, so it never drifts
// out of sync with variants[] regardless of which path touched it.
export function applyStockDelta(productData: any, target: ResolvedVariantTarget, delta: number): Record<string, any> {
  if (target.source === 'flat') {
    return { stock: Math.max(0, (Number(productData.stock) || 0) + delta) };
  }
  const variants: any[] = (Array.isArray(productData.variants) ? productData.variants : []).map((v: any) => ({ ...v }));
  const v = variants[target.index!];
  v.stock = Math.max(0, (Number(v.stock) || 0) + delta);
  const flatStock = variants.reduce((sum, vv) => sum + (Number(vv.stock) || 0), 0);
  return { variants, stock: flatStock };
}
