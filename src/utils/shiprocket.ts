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
