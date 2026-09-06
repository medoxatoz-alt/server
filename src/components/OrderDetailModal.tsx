'use client';

import { useState } from 'react';
import { X, Package, MapPin, Clock, CheckCircle, XCircle, Truck, ShoppingBag, Store, ExternalLink, Download } from 'lucide-react';
import ConfirmActionModal from './ConfirmActionModal';
import VendorProfileModal from './VendorProfileModal';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface OrderItem {
  productId: string;
  title: string;
  price: number;
  qty: number;
  subtotal: number;
  image: string;
}

interface TimelineEntry {
  status: string;
  timestamp: string;
}

interface Order {
  id: string;
  orderId: string;
  vendorId?: string;
  customerId: string;
  customerEmail: string;
  status: string;
  totalAmount: number;
  paymentMethod?: string;
  createdAt: string;
  items: OrderItem[];
  shippingDetails?: {
    fullName: string;
    phone: string;
    address: string;
    city: string;
    state: string;
    pincode: string;
  };
  timeline?: TimelineEntry[];
  trackingId?: string;
  trackingLink?: string;
  cashfreeOrderId?: string;
  cashfreePaymentId?: string;
  awbCode?: string;
  courierName?: string;
  invoiceUrl?: string;
  refundId?: string;
}

interface OrderDetailModalProps {
  order: Order;
  viewerUid?: string;
  viewerRole?: string;
  onClose: () => void;
  onStatusChange?: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  Pending:   'bg-blue-50 text-blue-700 border-blue-200',
  Approved:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  Rejected:  'bg-red-50 text-red-700 border-red-200',
  Delivered: 'bg-purple-50 text-purple-700 border-purple-200',
};

const TIMELINE_ICONS: Record<string, React.ReactNode> = {
  Pending:   <ShoppingBag className="w-3.5 h-3.5" />,
  Approved:  <CheckCircle className="w-3.5 h-3.5" />,
  Rejected:  <XCircle className="w-3.5 h-3.5" />,
  Delivered: <Truck className="w-3.5 h-3.5" />,
};

export default function OrderDetailModal({
  order,
  viewerUid,
  viewerRole,
  onClose,
  onStatusChange,
}: OrderDetailModalProps) {
  const [showDeliveredConfirm, setShowDeliveredConfirm] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [viewVendorUid, setViewVendorUid] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showApproveForm, setShowApproveForm] = useState(false);
  const [trackingId, setTrackingId] = useState('');
  const [trackingLink, setTrackingLink] = useState('');

  const isOwner = order.vendorId === viewerUid;
  const canAct = viewerRole === 'admin' || (viewerRole === 'vendor' && isOwner);

  const handleApproveSubmit = async () => {
    if (!trackingId.trim() || !trackingLink.trim()) {
      toast.error('Both tracking ID and tracking link are required');
      return;
    }
    setIsUpdating(true);
    try {
      await api.patch(`/orders/${order.id}`, {
        status: 'Approved',
        trackingId: trackingId.trim(),
        trackingLink: trackingLink.trim(),
      });
      toast.success(`Order marked as Approved`);
      onStatusChange?.();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to update order';
      toast.error(msg);
    } finally {
      setIsUpdating(false);
      setShowApproveForm(false);
    }
  };

  const updateStatus = async (status: string) => {
    setIsUpdating(true);
    try {
      await api.patch(`/orders/${order.id}`, { status });
      toast.success(`Order marked as ${status}`);
      onStatusChange?.();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Failed to update order';
      toast.error(msg);
    } finally {
      setIsUpdating(false);
      setShowDeliveredConfirm(false);
    }
  };

  const handleCancelOrder = async () => {
    setIsUpdating(true);
    try {
      await api.post(`/orders/${order.id}/cancel`);
      toast.success('Order cancelled and refund initiated');
      onStatusChange?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to cancel order');
    } finally {
      setIsUpdating(false);
      setShowCancelConfirm(false);
    }
  };

  const displayStatus = order.status === 'Pending' ? 'Approved' : order.status;

  const timeline: TimelineEntry[] = order.timeline?.length
    ? order.timeline.map(t => t.status === 'Pending' ? { ...t, status: 'Approved' } : t)
    : [{ status: 'Approved', timestamp: order.createdAt }];

  return (
    <>
      {/* Container: 
        Mobile -> items-end (Bottom Sheet) 
        Desktop -> sm:items-center sm:p-4 (Centered Modal) 
      */}
      <div className="fixed inset-0 z-[2000] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4 transition-all">
        
        {/* Modal Box: 
          Mobile -> w-full, rounded top corners, slide up animation 
          Desktop -> max-w-2xl, fully rounded, zoom-in animation 
        */}
        <div className="bg-white w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden rounded-t-[2rem] sm:rounded-2xl shadow-2xl animate-in slide-in-from-bottom-full sm:slide-in-from-bottom-0 sm:zoom-in duration-300 pb-safe">
          
          {/* Mobile Drag Indicator Pill */}
          <div className="w-full flex justify-center pt-3 pb-2 bg-gray-50/80 sm:hidden flex-shrink-0 rounded-t-[2rem]">
            <div className="w-12 h-1.5 bg-gray-300 rounded-full" />
          </div>

          {/* Header */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 bg-gray-50/80 flex items-center gap-3 flex-shrink-0">
            <div className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-gold-primary/10 flex items-center justify-center flex-shrink-0">
              <Package className="w-5 h-5 text-gold-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-lg font-extrabold text-gray-900 truncate">Order #{order.orderId}</h2>
              <p className="text-xs text-gray-500 mt-0.5 truncate">{order.customerEmail}</p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold border whitespace-nowrap ${STATUS_COLORS[displayStatus] || 'bg-gray-50 text-gray-700 border-gray-200'}`}>
              {displayStatus}
            </span>
            <button onClick={onClose} className="ml-1 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 active:bg-gray-300 rounded-full transition-all cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">

            {/* Items */}
            <section>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Items</h3>
              <div className="space-y-3">
                {order.items.map((item, i) => (
                  <div key={i} className="flex gap-3 sm:gap-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <img
                      src={item.image || 'https://via.placeholder.com/60'}
                      alt={item.title}
                      className="w-16 h-16 sm:w-14 sm:h-14 object-contain rounded-lg bg-white border border-gray-100 p-1 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                      <p className="font-semibold text-sm text-gray-900 line-clamp-2">{item.title}</p>
                      <p className="text-xs text-gray-500 mt-1">Qty: {item.qty} × ₹{item.price.toLocaleString('en-IN')}</p>
                    </div>
                    <div className="font-extrabold text-gray-900 text-sm flex-shrink-0 flex items-center">
                      ₹{item.subtotal.toLocaleString('en-IN')}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center px-1">
                <span className="text-sm font-bold text-gray-600">Total</span>
                <span className="text-xl font-extrabold text-gold-primary">₹{Number(order.totalAmount).toLocaleString('en-IN')}</span>
              </div>
            </section>

            {/* Shipping & Payment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {order.shippingDetails && (
                <section className="bg-gray-50 rounded-xl border border-gray-100 p-4">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <MapPin className="w-4 h-4" /> Shipping
                  </h3>
                  <p className="font-bold text-sm text-gray-900">{order.shippingDetails.fullName}</p>
                  <p className="text-[13px] text-gray-600 mt-1.5 leading-relaxed">
                    {order.shippingDetails.address}<br />
                    {order.shippingDetails.city}, {order.shippingDetails.state} {order.shippingDetails.pincode}
                  </p>
                  <p className="text-[13px] text-gray-500 mt-2 font-medium">📞 {order.shippingDetails.phone}</p>
                </section>
              )}

              <section className="bg-gray-50 rounded-xl border border-gray-100 p-4">
                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Payment</h3>
                <p className="font-semibold text-sm text-gray-900">{order.paymentMethod || 'N/A'}</p>
                <p className="text-[13px] text-gray-500 mt-1.5">Placed on {new Date(order.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                {order.cashfreePaymentId && viewerRole !== 'vendor' && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Cashfree Order ID</p>
                    <p className="font-mono text-xs text-gray-700 mt-0.5 break-all">{order.cashfreeOrderId}</p>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-2">Payment ID</p>
                    <p className="font-mono text-xs text-gray-700 mt-0.5 break-all">{order.cashfreePaymentId}</p>
                  </div>
                )}
                {order.invoiceUrl && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    {(new Date().getTime() - new Date(order.createdAt).getTime()) > 30 * 24 * 60 * 60 * 1000 ? (
                      <div className="w-full px-4 py-2 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5">
                        <XCircle className="w-3.5 h-3.5" /> Invoice Expired & Deleted
                      </div>
                    ) : (
                      <>
                        <a
                          href={order.invoiceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full px-4 py-2 bg-gray-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5" /> Download Invoice
                        </a>
                        <p className="text-[10px] text-gray-400 text-center mt-1.5 italic">
                          Note: Invoices are automatically deleted after 30 days to save space.
                        </p>
                      </>
                    )}
                  </div>
                )}
              </section>

              {order.refundId && (
                <section className="bg-red-50/50 rounded-xl border border-red-100 p-4 col-span-1 sm:col-span-2">
                  <h3 className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <XCircle className="w-4 h-4" /> Refund Initiated
                  </h3>
                  <p className="text-[13px] text-red-800 leading-relaxed">
                    Your refund (ID: <span className="font-mono font-bold bg-white/60 px-1.5 py-0.5 rounded text-xs border border-red-200">{order.refundId}</span>) has been automatically initiated. 
                    Please allow 5-7 business days for the amount to reflect in your original payment method.
                  </p>
                </section>
              )}

              {order.trackingId && (
                <section className="bg-emerald-50/50 rounded-xl border border-emerald-100 p-4 col-span-1 sm:col-span-2">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-emerald-600" /> Tracking Information
                  </h3>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
                    <div>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">
                        {order.courierName ? `Courier: ${order.courierName}` : 'Tracking ID'}
                      </p>
                      <p className="font-bold font-mono text-gray-900 mt-0.5">{order.awbCode || order.trackingId}</p>
                    </div>
                    <div>
                      <a
                        href={order.trackingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all cursor-pointer border border-transparent flex items-center justify-center gap-1 text-xs"
                      >
                        Track Shipment <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                </section>
              )}

              {viewerRole === 'admin' && (
                <section className="bg-blue-50/50 rounded-xl border border-blue-100 p-4 col-span-1 sm:col-span-2">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <Store className="w-4 h-4 text-blue-500" /> Vendor Information
                  </h3>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      {order.vendorId === 'admin' || !order.vendorId ? (
                        <>
                          <p className="font-bold text-sm text-gray-900">Medox Admin Store</p>
                          <p className="text-[13px] text-gray-500 mt-0.5">Direct sale by administrator</p>
                        </>
                      ) : (
                        <>
                          <p className="font-bold text-sm text-gray-900 truncate">ID: {order.vendorId}</p>
                          <p className="text-[13px] text-gray-500 mt-0.5">Third-party vendor</p>
                        </>
                      )}
                    </div>
                    {order.vendorId !== 'admin' && order.vendorId && (
                      <button
                        type="button"
                        onClick={() => setViewVendorUid(order.vendorId || null)}
                        className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-blue-100/50 hover:bg-blue-100 text-blue-700 active:bg-blue-200 text-sm sm:text-xs font-bold rounded-xl transition-all cursor-pointer border border-blue-200 flex justify-center"
                      >
                        View Profile
                      </button>
                    )}
                  </div>
                </section>
              )}
            </div>

            {/* Timeline */}
            <section>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> Order Timeline
              </h3>
              <div className="relative pl-7 sm:pl-6">
                <div className="absolute left-[13px] sm:left-[9px] top-2 bottom-2 w-px bg-gray-200" />
                <div className="space-y-5">
                  {timeline.map((entry, i) => (
                    <div key={i} className="relative flex items-start gap-4">
                      <div className={`absolute -left-7 sm:-left-6 w-6 h-6 sm:w-5 sm:h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        i === timeline.length - 1 ? 'bg-gold-primary border-gold-primary text-white' : 'bg-white border-gray-300 text-gray-400'
                      }`}>
                        {TIMELINE_ICONS[entry.status] || <Clock className="w-3 h-3 sm:w-2.5 sm:h-2.5" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-800">{entry.status}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(entry.timestamp).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>

          {/* Action Footer */}
          {(order.status === 'Approved') && (
            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-[2rem] sm:rounded-b-2xl">
              {canAct && (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="px-4 py-2 bg-red-500 text-white hover:bg-red-600 font-bold text-sm rounded-xl transition-all flex items-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" /> Cancel Order
                </button>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Confirmation Modals */}
      {showDeliveredConfirm && (
        <ConfirmActionModal
          title="Mark as Delivered?"
          description={`Order #${order.orderId}`}
          warningText="⚠️ This action is permanent and cannot be undone."
          warningPoints={[
            "The order will be marked as Delivered",
            "No further status changes will be possible",
            "The customer will see this order as completed"
          ]}
          confirmWord="CONFIRM"
          actionButtonLabel="Confirm Delivery"
          actionButtonLabelAnyway="Mark Delivered Anyway"
          onConfirm={() => updateStatus('Delivered')}
          onCancel={() => setShowDeliveredConfirm(false)}
          isLoading={isUpdating}
          variant="danger"
        />
      )}

      {showRejectConfirm && (
        <ConfirmActionModal
          title="Reject Order?"
          description={`Order #${order.orderId}`}
          warningText="⚠️ Rejecting this order cannot be undone."
          warningPoints={[
            "The order status will be changed to Rejected",
            "The customer will receive a rejection notification"
          ]}
          confirmWord="CONFIRM"
          actionButtonLabel="Confirm Reject"
          actionButtonLabelAnyway="Reject Order Anyway"
          onConfirm={() => updateStatus('Rejected')}
          onCancel={() => setShowRejectConfirm(false)}
          isLoading={isUpdating}
          variant="danger"
        />
      )}

      {showCancelConfirm && (
        <ConfirmActionModal
          title="Cancel Order & Refund?"
          description={`Order #${order.orderId}`}
          warningText="⚠️ Cancelling this order is permanent."
          warningPoints={[
            "The Shiprocket shipment will be cancelled",
            "The customer will be fully refunded",
            "The order status will change to Cancelled"
          ]}
          confirmWord="CANCEL"
          actionButtonLabel="Cancel Order"
          onConfirm={handleCancelOrder}
          onCancel={() => setShowCancelConfirm(false)}
          isLoading={isUpdating}
          variant="danger"
        />
      )}

      {viewVendorUid && (
        <VendorProfileModal
          vendorId={viewVendorUid}
          onClose={() => setViewVendorUid(null)}
        />
      )}
    </>
  );
}