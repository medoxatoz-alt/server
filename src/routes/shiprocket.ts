// src/routes/shiprocket.ts — Shiprocket tracking webhook + serviceability

import { Router, Request, Response } from 'express';
import { db } from '../firebase';
import { verifyToken } from '../middleware/verifyToken';
import { checkServiceability } from '../utils/shiprocket';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/shipment/serviceability?pincode=XXXXXX&weight=Y
// Real delivery-date estimate for a pincode, from Shiprocket's own
// serviceability check (same data Shiprocket uses to route the order) --
// used by the product page's delivery estimate widget.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/serviceability', verifyToken, async (req: Request, res: Response) => {
  const pincode = String(req.query.pincode || '').trim();
  if (!/^\d{6}$/.test(pincode)) {
    res.status(400).json({ error: 'A valid 6-digit pincode is required.' });
    return;
  }
  const weight = Number(req.query.weight);

  try {
    const result = await checkServiceability(pincode, Number.isFinite(weight) && weight > 0 ? weight : 0.5);
    res.json(result);
  } catch {
    res.status(500).json({ error: 'Failed to check delivery serviceability.' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/shipment/webhook
// Shiprocket calls this with tracking updates. Configure in Shiprocket panel:
// Settings → API → Webhooks → enter your server URL + /api/shipment/webhook,
// and set "Token" to the exact value of SHIPROCKET_WEBHOOK_TOKEN below —
// Shiprocket echoes it back on every call in the `x-api-key` header.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    // ── Verify the shared secret Shiprocket sends back ──────────────────────
    const expectedToken = process.env.SHIPROCKET_WEBHOOK_TOKEN;
    if (expectedToken) {
      const providedToken = req.headers['x-api-key'];
      if (providedToken !== expectedToken) {
        console.warn('[Shiprocket Webhook] Invalid or missing x-api-key token');
        res.status(401).json({ error: 'Invalid webhook token' });
        return;
      }
    } else {
      // Not configured yet — accept but warn loudly so this doesn't stay silent.
      console.warn('[Shiprocket Webhook] SHIPROCKET_WEBHOOK_TOKEN not set — webhook is UNAUTHENTICATED. Set it in .env and in the Shiprocket panel.');
    }

    const body = req.body;

    // Shiprocket webhook fields (vary by event type)
    const awb: string = body?.awb || body?.awb_code || '';
    const shiprocketShipmentId: number | undefined = body?.shipment_id || body?.id;
    const srStatus: string = body?.current_status || body?.status || '';
    const srStatusCode: number | undefined = body?.current_status_id;

    if (!awb && !shiprocketShipmentId) {
      console.warn('[Shiprocket Webhook] No AWB or shipment_id in payload:', body);
      res.status(200).json({ received: true });
      return;
    }

    console.log(`[Shiprocket Webhook] AWB: ${awb}, Status: ${srStatus}`);

    // Find the order by AWB code or shiprocketShipmentId
    let orderSnap: FirebaseFirestore.QuerySnapshot | null = null;

    if (awb) {
      orderSnap = await db.collection('orders').where('awbCode', '==', awb).limit(1).get();
    }
    if ((!orderSnap || orderSnap.empty) && shiprocketShipmentId) {
      orderSnap = await db.collection('orders').where('shiprocketShipmentId', '==', shiprocketShipmentId).limit(1).get();
    }

    if (!orderSnap || orderSnap.empty) {
      console.warn('[Shiprocket Webhook] No matching order found for AWB:', awb);
      res.status(200).json({ received: true }); // Acknowledge to prevent retries
      return;
    }

    const orderRef = orderSnap.docs[0].ref;
    const timestamp = new Date().toISOString();

    // Map Shiprocket status to our order statuses
    // Status code 7 = Delivered
    const isDelivered = srStatusCode === 7 || srStatus?.toLowerCase().includes('delivered');

    const updateFields: Record<string, any> = {
      shiprocketStatus: srStatus,
      timeline: require('firebase-admin').firestore.FieldValue.arrayUnion({
        status: srStatus,
        timestamp,
        source: 'Shiprocket',
      }),
    };
    // srStatusCode is only present on some Shiprocket event types -- omit the
    // key entirely rather than writing an explicit `undefined` (Firestore
    // rejects any document write containing one).
    if (srStatusCode !== undefined) {
      updateFields.shiprocketStatusCode = srStatusCode;
    }

    if (isDelivered) {
      updateFields.status = 'Delivered';
      updateFields.deliveredAt = timestamp;
    }

    await orderRef.update(updateFields);
    console.log(`[Shiprocket Webhook] Updated order ${orderSnap.docs[0].id} → ${srStatus}`);

    res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('[Shiprocket Webhook] Error:', err.message);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
