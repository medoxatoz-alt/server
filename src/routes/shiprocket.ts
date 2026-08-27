// src/routes/shiprocket.ts — Shiprocket tracking webhook

import { Router, Request, Response } from 'express';
import { db } from '../firebase';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/shiprocket/webhook
// Shiprocket calls this with tracking updates (configure in Shiprocket panel:
// Settings → API → Webhooks → enter your server URL + /api/shiprocket/webhook)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/webhook', async (req: Request, res: Response) => {
  try {
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
      shiprocketStatusCode: srStatusCode,
      [`shiprocket_${timestamp}`]: srStatus, // audit trail
      timeline: require('firebase-admin').firestore.FieldValue.arrayUnion({
        status: srStatus,
        timestamp,
        source: 'Shiprocket',
      }),
    };

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
