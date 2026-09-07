// src/types/index.ts — Shared TypeScript types

export interface UserSession {
  uid: string;
  email: string;
  phone?: string;
  name?: string;
  role: 'buyer' | 'vendor' | 'admin';
  status?: 'pending' | 'approved' | 'rejected';
}

// A product variant (e.g. a size). Optional on Product -- absent on every
// product created before this feature existed, so nothing about those
// products' behavior changes. When present, the product's top-level
// price/mrp/stock become a computed aggregate (see products.ts) purely so
// every screen that only knows about flat price/stock/image (ProductCard,
// admin/vendor tables, search, wishlist) keeps working unchanged.
export interface ProductVariant {
  id: string;
  label: string;
  price: number;
  mrp?: number;
  stock: number;
  images?: string[]; // falls back to the parent product's images when empty
}

export interface Product {
  id: string;
  title: string;
  mainCategoryId: string;
  subCategoryId?: string;
  brand?: string;
  price: number;
  mrp?: number;
  stock: number;
  description?: string;
  image: string | string[];
  vendorId?: string;
  rating?: number;
  reviewCount?: number;
  weight?: number; // kg
  length?: number; // cm
  breadth?: number; // cm
  height?: number; // cm
  attributes?: { key: string; value: string }[];
  is_sold_by_vendor?: boolean;
  createdAt?: string;
  variants?: ProductVariant[];
  // "How to Use" resources -- product-level, not per-variant.
  howToUsePdf?: string;
  resourceLinks?: { label: string; url: string }[];
}

export interface CartItem {
  productId: string;
  quantity: number;
  addedAt: string;
  variantId?: string;
}

export interface OrderItem {
  productId: string;
  title: string;
  price: number;
  qty: number;
  subtotal: number;
  image: string;
  weight?: number;
  length?: number;
  breadth?: number;
  height?: number;
  variantId?: string;
  variantLabel?: string;
}

export interface ShippingDetails {
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
}

export interface Order {
  id?: string;
  orderId: string;
  vendorId: string;
  // Snapshotted from the product's is_sold_by_vendor at order-creation time.
  // vendorId is always a real Firebase uid (the admin's own uid for
  // admin-created products, never the literal string 'admin') -- this flag
  // is the actual reliable way to tell "platform-owned" orders apart from a
  // specific vendor's, since any admin should be able to manage the former.
  sellerIsAdmin?: boolean;
  customerId: string;
  customerEmail: string;
  shippingDetails: ShippingDetails;
  items: OrderItem[];
  totalAmount: number;
  status: 'Approved' | 'Rejected' | 'Delivered' | 'Cancellation Requested' | 'Cancelled';
  paymentMethod: string;
  confirmedOrderId?: string;
  createdAt: string;
  timeline?: Array<{ status: string; timestamp: string }>;
  // Cashfree
  cashfreeOrderId?: string;
  cashfreePaymentId?: string;
  // Shiprocket
  shiprocketOrderId?: number;
  shiprocketShipmentId?: number;
  awbCode?: string;
  courierName?: string;
  trackingId?: string;
  trackingLink?: string;
  // Invoice
  invoiceUrl?: string;
}

export interface VendorProfile {
  uid: string;
  name: string;
  email: string;
  phone: string;
  storeName: string;
  gstNumber?: string;
  address?: string;
  role: 'vendor';
  status: 'pending' | 'approved' | 'rejected';
  createdAt?: string;
}

export interface Review {
  id?: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: UserSession;
    }
  }
}
