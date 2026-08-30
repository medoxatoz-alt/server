// src/types/index.ts — Shared TypeScript types

export interface UserSession {
  uid: string;
  email: string;
  phone?: string;
  name?: string;
  role: 'buyer' | 'vendor' | 'admin';
  status?: 'pending' | 'approved' | 'rejected';
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
  createdAt?: string;
}

export interface CartItem {
  productId: string;
  quantity: number;
  addedAt: string;
}

export interface OrderItem {
  productId: string;
  title: string;
  price: number;
  qty: number;
  subtotal: number;
  image: string;
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
  customerId: string;
  customerEmail: string;
  shippingDetails: ShippingDetails;
  items: OrderItem[];
  totalAmount: number;
  status: 'Approved' | 'Rejected' | 'Delivered';
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
