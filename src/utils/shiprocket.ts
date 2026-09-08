// src/utils/shiprocket.ts — Shiprocket API helper with token caching

import axios from 'axios';
import { Order } from '../types';

const SHIPROCKET_BASE = 'https://apiv2.shiprocket.in/v1/external';

// ── In-memory token cache (valid for 9 days to be safe; tokens last 10 days) ──
let cachedToken: string | null = null;
let tokenExpiresAt: number = 0;
const TOKEN_TTL_MS = 9 * 24 * 60 * 60 * 1000; // 9 days

async function getToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  const email = process.env.SHIPROCKET_EMAIL;
  const password = process.env.SHIPROCKET_PASSWORD;

  if (!email || !password) {
    throw new Error('Shiprocket credentials not configured in environment variables.');
  }

  const { data } = await axios.post(`${SHIPROCKET_BASE}/auth/login`, { email, password });

  if (!data.token) {
    throw new Error('Shiprocket authentication failed: no token returned.');
  }

  cachedToken = data.token;
  tokenExpiresAt = now + TOKEN_TTL_MS;
  return cachedToken!;
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

// Deep link back to this order in the admin portal -- Shiprocket access is
// admin-only (both for the platform's own orders and every vendor's, since
// vendors have no Shiprocket access of their own), so every shipment's
// comment always points at the admin dashboard's "All Orders" view,
// regardless of who the order actually belongs to.
function buildOrderPortalLink(order: Order): string {
  const frontendUrl = process.env.FRONTEND_URL || 'https://medoxatoz.com';
  return `${frontendUrl}/admin?tab=all-orders&orderId=${encodeURIComponent(order.id || '')}`;
}

// ── Create Shiprocket order + assign AWB ──────────────────────────────────────
export async function createShiprocketShipment(order: Order): Promise<{
  shiprocketOrderId: number;
  shiprocketShipmentId: number;
  awbCode: string;
  courierName: string;
  trackingLink: string;
}> {
  const token = await getToken();
  const s = order.shippingDetails;

  // Aggregate package metrics
  let totalWeight = 0;
  let maxLength = 1;
  let maxBreadth = 1;
  let totalHeight = 0;

  for (const item of order.items) {
    totalWeight += (item.weight || 0.5) * item.qty;
    maxLength = Math.max(maxLength, item.length || 10);
    maxBreadth = Math.max(maxBreadth, item.breadth || 10);
    totalHeight += (item.height || 10) * item.qty;
  }

  // 1. Create order
  const orderPayload = {
    order_id: order.orderId,
    order_date: order.createdAt.substring(0, 10), // YYYY-MM-DD
    pickup_location: process.env.SHIPROCKET_PICKUP_LOCATION || 'Primary',
    billing_customer_name: s.fullName,
    billing_last_name: '',
    billing_address: s.address,
    billing_city: s.city,
    billing_pincode: s.pincode,
    billing_state: s.state,
    billing_country: 'India',
    billing_email: s.email || order.customerEmail,
    billing_phone: s.phone,
    shipping_is_billing: true,
    order_items: order.items.map(i => ({
      name: i.title,
      sku: String(i.productId),
      units: i.qty,
      selling_price: i.price,
    })),
    payment_method: order.paymentMethod === 'COD' ? 'COD' : 'Prepaid',
    sub_total: order.totalAmount,
    length: maxLength,
    breadth: maxBreadth,
    height: totalHeight,
    weight: totalWeight,
    // Shows up on this order inside Shiprocket's own dashboard -- a direct
    // link back to it in the admin or vendor portal (see buildOrderPortalLink).
    comment: `Medox order: ${buildOrderPortalLink(order)}`,
  };

  const createRes = await axios.post(
    `${SHIPROCKET_BASE}/orders/create/adhoc`,
    orderPayload,
    { headers: authHeaders(token) }
  );

  const shiprocketOrderId: number = createRes.data.order_id;
  const shiprocketShipmentId: number = createRes.data.shipment_id;

  // 2. Assign AWB (auto-assign best available courier)
  const awbRes = await axios.post(
    `${SHIPROCKET_BASE}/courier/assign/awb`,
    { shipment_id: String(shiprocketShipmentId) },
    { headers: authHeaders(token) }
  );

  const awbData = awbRes.data?.response?.data;
  const awbCode: string = awbData?.awb_code || awbData?.awb || '';
  const courierName: string = awbData?.courier_name || awbData?.courier_company_id || 'Shiprocket';

  const trackingLink = awbCode
    ? `https://shiprocket.co/tracking/${awbCode}`
    : `https://shiprocket.co/tracking/order/${shiprocketOrderId}`;

  return { shiprocketOrderId, shiprocketShipmentId, awbCode, courierName, trackingLink };
}

// ── Pickup pincode (cached) ────────────────────────────────────────────────────
// Shiprocket's serviceability API needs the actual pickup postcode, not the
// pickup location name from SHIPROCKET_PICKUP_LOCATION -- resolve it once
// from Shiprocket's own registered pickup addresses instead of duplicating
// it into a second env var that could drift out of sync.
let pickupPincodeCache: { pincode: string; expiresAt: number } | null = null;
const PICKUP_PINCODE_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

async function getPickupPincode(): Promise<string> {
  if (pickupPincodeCache && Date.now() < pickupPincodeCache.expiresAt) {
    return pickupPincodeCache.pincode;
  }
  const token = await getToken();
  const { data } = await axios.get(`${SHIPROCKET_BASE}/settings/company/pickup`, { headers: authHeaders(token) });
  const pickupLocationName = process.env.SHIPROCKET_PICKUP_LOCATION || 'Primary';
  const addresses: any[] = data?.data?.shipping_address || [];
  const match = addresses.find(a => a.pickup_location === pickupLocationName) || addresses[0];
  if (!match?.pin_code) throw new Error('Could not resolve a Shiprocket pickup pincode.');

  pickupPincodeCache = { pincode: String(match.pin_code), expiresAt: Date.now() + PICKUP_PINCODE_TTL_MS };
  return pickupPincodeCache.pincode;
}

// ── Serviceability / delivery estimate (cached per pincode+weight) ────────────
export interface ServiceabilityResult {
  serviceable: boolean;
  estimatedDeliveryDate?: string; // 'YYYY-MM-DD'
  courierName?: string;
}

const serviceabilityCache = new Map<string, { result: ServiceabilityResult; expiresAt: number }>();
const SERVICEABILITY_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours -- real courier ETDs, but no need to hit Shiprocket on every page view

function toDateOnly(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Shiprocket's `etd` field is a display string like "Sep 10, 2026" (confirmed
// against the live API -- not the "YYYY-MM-DD HH:mm:ss" its docs suggest).
// Node's Date constructor parses that format reliably, so use it directly
// rather than string-splitting. Falls back to today + `estimated_delivery_days`
// (calendar days, matching how couriers quote total transit time) when `etd`
// is missing or unparseable for a given courier.
function normalizeEtd(courier: any): string | undefined {
  if (typeof courier.etd === 'string' && courier.etd.trim()) {
    const parsed = new Date(courier.etd);
    if (!isNaN(parsed.getTime())) return toDateOnly(parsed);
  }
  const days = Number(courier.estimated_delivery_days);
  if (Number.isFinite(days) && days > 0) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return toDateOnly(d);
  }
  return undefined;
}

// Real courier-quoted delivery estimate for a pincode, via Shiprocket's own
// serviceability check -- the same data Shiprocket itself uses to decide
// which couriers can even deliver there. Falls back to
// `{ serviceable: true }` (no date) on any failure so the caller can fall
// back to a generic estimate rather than breaking the page.
export async function checkServiceability(deliveryPincode: string, weightKg: number): Promise<ServiceabilityResult> {
  const roundedWeight = Math.max(0.1, Math.ceil(weightKg * 2) / 2); // round up to nearest 0.5kg for cache reuse
  const cacheKey = `${deliveryPincode}:${roundedWeight}`;
  const cached = serviceabilityCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) return cached.result;

  try {
    const [token, pickupPincode] = await Promise.all([getToken(), getPickupPincode()]);
    const { data } = await axios.get(`${SHIPROCKET_BASE}/courier/serviceability/`, {
      headers: authHeaders(token),
      params: {
        pickup_postcode: pickupPincode,
        delivery_postcode: deliveryPincode,
        weight: roundedWeight,
        cod: 0,
      },
    });

    const couriers: any[] = data?.data?.available_courier_companies || [];
    let result: ServiceabilityResult;

    if (couriers.length === 0) {
      result = { serviceable: false };
    } else {
      const recommendedId = data?.data?.recommended_courier_company_id;
      const byFastestEtd = [...couriers].sort((a, b) => {
        const da = a.estimated_delivery_days != null ? Number(a.estimated_delivery_days) : 99;
        const db = b.estimated_delivery_days != null ? Number(b.estimated_delivery_days) : 99;
        return da - db;
      });
      const chosen = couriers.find(c => c.courier_company_id === recommendedId) || byFastestEtd[0];

      result = {
        serviceable: true,
        estimatedDeliveryDate: normalizeEtd(chosen),
        courierName: chosen.courier_name,
      };
    }

    serviceabilityCache.set(cacheKey, { result, expiresAt: Date.now() + SERVICEABILITY_TTL_MS });
    return result;
  } catch (err: any) {
    console.error('[Shiprocket] Serviceability check failed:', err?.response?.data || err.message);
    return { serviceable: true }; // fail open -- caller falls back to a generic estimate
  }
}

// ── Cancel a Shiprocket order ─────────────────────────────────────────────────
export async function cancelShiprocketOrder(shiprocketOrderId: number): Promise<void> {
  try {
    const token = await getToken();
    await axios.post(
      `${SHIPROCKET_BASE}/orders/cancel`,
      { ids: [shiprocketOrderId] },
      { headers: authHeaders(token) }
    );
    console.log(`[Shiprocket] Cancelled order ${shiprocketOrderId}`);
  } catch (err: any) {
    console.error('[Shiprocket] Failed to cancel order:', err?.response?.data || err.message);
    // Non-fatal — don't re-throw
  }
}
