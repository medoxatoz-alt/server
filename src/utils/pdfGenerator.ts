import PDFDocument from 'pdfkit';
import { Order } from '../types';

const formatCurrency = (amount: number) => `Rs. ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
const formatDate = (dateString: string | Date) => new Date(dateString).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

// Cached across invocations so we don't re-fetch the logo over the network
// for every single invoice. A failed fetch is not cached, so it retries next time.
let cachedLogoBuffer: Buffer | null = null;
async function getLogoBuffer(): Promise<Buffer | null> {
  if (cachedLogoBuffer) return cachedLogoBuffer;
  try {
    const logoRes = await fetch('https://ik.imagekit.io/kgigyn2hm/logo-removebg-preview.png');
    if (logoRes.ok) {
      const arrayBuffer = await logoRes.arrayBuffer();
      cachedLogoBuffer = Buffer.from(arrayBuffer);
    }
  } catch (err) {
    console.warn('Failed to fetch logo, proceeding without it:', err);
  }
  return cachedLogoBuffer;
}

export async function generateInvoicePdf(order: Order): Promise<Buffer> {
  const logoBuffer = await getLogoBuffer();

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const buffers: Buffer[] = [];
      
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // --- HEADER ---
      // 1. ONLY Logo on the top left
      if (logoBuffer) {
        doc.image(logoBuffer, 50, 40, { width: 140 }); // Increased size slightly to stand alone
      }

      // Invoice Details (Right)
      doc.fillColor('#111827')
         .fontSize(20)
         .font('Helvetica-Bold')
         .text('INVOICE', 400, 50, { width: 145, align: 'right' })
         .fontSize(10)
         .font('Helvetica')
         .fillColor('#4B5563')
         .text(`Invoice #: ${order.orderId}`, 400, 75, { width: 145, align: 'right' })
         .text(`Date: ${formatDate(order.createdAt)}`, 400, 90, { width: 145, align: 'right' })
         .text(`Payment Method: ${order.paymentMethod}`, 400, 105, { width: 145, align: 'right' });

      doc.moveTo(50, 135).lineTo(545, 135).strokeColor('#E5E7EB').stroke();

      // --- BILLING INFO ---
      doc.fillColor('#111827')
         .fontSize(11)
         .font('Helvetica-Bold')
         .text('Billed To:', 50, 155)
         .font('Helvetica')
         .fontSize(10)
         .fillColor('#374151');

      // 2. THE FIX: Stop hardcoding Y-coordinates!
      // We set X and Y once for the full name. For the following lines, we omit coordinates. 
      // PDFKit will automatically calculate the height of multiline addresses and flow down gracefully.
      doc.text(order.shippingDetails.fullName, 50, 175);
      doc.text(order.shippingDetails.address); 
      doc.text(`${order.shippingDetails.city}, ${order.shippingDetails.state} - ${order.shippingDetails.pincode}`);
      doc.text(`Phone: ${order.shippingDetails.phone}`);
      doc.text(`Email: ${order.customerEmail}`);

      // --- ITEMS TABLE HEADER ---
      // 3. Dynamic Spacing: Grab the current Y position after the address finishes printing
      // and add a 30px buffer before starting the table.
      let y = doc.y + 30;
      
      doc.rect(50, y, 495, 20).fill('#F3F4F6');

      doc.font('Helvetica-Bold')
         .fillColor('#111827')
         .fontSize(9);
         
      doc.text('ITEM DESCRIPTION', 60, y + 6)
         .text('PRICE', 280, y + 6, { width: 90, align: 'right' })
         .text('QTY', 370, y + 6, { width: 40, align: 'right' })
         .text('TOTAL', 420, y + 6, { width: 115, align: 'right' });

      y += 30; 

      // --- ITEMS LOOP WITH PAGINATION ---
      doc.font('Helvetica').fontSize(9).fillColor('#374151');
      
      for (const item of order.items) {
        if (y > 700) {
          doc.addPage();
          y = 50; 
        }

        const shortTitle = item.title.length > 55 ? item.title.substring(0, 52) + '...' : item.title;
        
        doc.text(shortTitle, 60, y, { width: 220 })
           .text(formatCurrency(item.price), 280, y, { width: 90, align: 'right' })
           .text(item.qty.toString(), 370, y, { width: 40, align: 'right' })
           .text(formatCurrency(item.subtotal), 420, y, { width: 115, align: 'right' });
        
        y += 20;
        doc.moveTo(50, y).lineTo(545, y).strokeColor('#F3F4F6').stroke();
        y += 10;
      }

      // --- TOTALS ---
      if (y > 650) {
        doc.addPage();
        y = 50;
      }

      y += 10;
      doc.font('Helvetica-Bold')
         .fillColor('#111827')
         .fontSize(10)
         .text('Subtotal:', 320, y, { width: 90, align: 'right' })
         .text(formatCurrency(order.totalAmount), 420, y, { width: 115, align: 'right' });
         
      y += 18;
      doc.text('Shipping:', 320, y, { width: 90, align: 'right' })
         .fillColor('#059669') 
         .text('FREE', 420, y, { width: 115, align: 'right' });
         
      y += 15;
      doc.moveTo(320, y).lineTo(545, y).strokeColor('#E5E7EB').stroke();
      
      y += 10;
      doc.fontSize(12)
         .fillColor('#D97706') 
         .text('Grand Total:', 300, y, { width: 110, align: 'right' })
         .text(formatCurrency(order.totalAmount), 420, y, { width: 115, align: 'right' });

      // --- FOOTER ---
      doc.fontSize(9)
         .font('Helvetica')
         .fillColor('#9CA3AF')
         .text('Thank you for shopping with MedoxAtoZ!', 50, 750, { align: 'center', width: 495 })
         .text('If you have any questions about this invoice, please contact support@medoxatoz.com', 50, 765, { align: 'center', width: 495 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}