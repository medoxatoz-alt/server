'use client';

import { useState } from 'react';
import { CheckCircle, XCircle, Eye, Building2, Users, User } from 'lucide-react';
import PaginationBar from '@/components/PaginationBar';
import EmptyState from '@/components/EmptyState';
import ErrorState from '@/components/ErrorState';
import { usePagination } from '@/hooks/usePagination';
import ConfirmActionModal from '@/components/ConfirmActionModal';
import VendorProfileModal from '@/components/VendorProfileModal';

interface VendorsTabProps {
  vendors: any[];
  isFetching: boolean;
  fetchError: boolean;
  onApprove: (uid: string) => void;
  onReject: (uid: string) => void;
  onViewProducts: (uid: string, name: string) => void;
}

function SkeletonRow() {
  return (
    <tr className="border-b border-gray-50">
      <td className="py-4 px-5"><div className="flex items-center gap-3"><div className="w-9 h-9 bg-gray-100 rounded-xl animate-pulse" /><div className="h-4 bg-gray-100 rounded w-32 animate-pulse" /></div></td>
      <td className="py-4 px-5"><div className="h-4 bg-gray-100 rounded w-48 animate-pulse" /></td>
      <td className="py-4 px-5"><div className="h-5 bg-gray-100 rounded-full w-20 animate-pulse" /></td>
      <td className="py-4 px-5"><div className="h-4 bg-gray-100 rounded w-28 ml-auto animate-pulse" /></td>
    </tr>
  );
}

export default function VendorsTab({ vendors, isFetching, fetchError, onApprove, onReject, onViewProducts }: VendorsTabProps) {
  const { page, setPage, totalPages, slice, total } = usePagination(vendors, 10);
  const [selectedVendorForProfile, setSelectedVendorForProfile] = useState<any | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'approve' | 'reject';
    uid: string;
    storeName: string;
  } | null>(null);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
      {/* Table header bar */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3 bg-gradient-to-r from-gray-50 to-white">
        <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
          <Users className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-800">All Vendors</h3>
          <p className="text-xs text-gray-400">{total} registered</p>
        </div>
      </div>

      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/60">
            <th className="py-3 px-5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Vendor</th>
            <th className="py-3 px-5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Email</th>
            <th className="py-3 px-5 font-semibold text-gray-500 text-xs uppercase tracking-wider">Status</th>
            <th className="py-3 px-5 font-semibold text-gray-500 text-xs uppercase tracking-wider text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {isFetching ? (
            Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
          ) : fetchError ? (
            <tr><td colSpan={4}><ErrorState message="Failed to load vendors." /></td></tr>
          ) : vendors.length === 0 ? (
            <tr><td colSpan={4}><EmptyState message="No vendors registered yet." /></td></tr>
          ) : (
            slice.map(v => (
              <tr key={v.uid} className="border-b border-gray-50 hover:bg-blue-50/20 transition-colors group">
                <td className="py-4 px-5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="font-semibold text-gray-800 text-sm">{v.storeName || v.displayName || 'N/A'}</span>
                  </div>
                </td>
                <td className="py-4 px-5 text-gray-500 text-sm">{v.email}</td>
                <td className="py-4 px-5">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
                    v.status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    v.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                    'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${v.status === 'approved' ? 'bg-emerald-500' : v.status === 'rejected' ? 'bg-red-500' : 'bg-amber-500'}`} />
                    {v.status || 'pending'}
                  </span>
                </td>
                <td className="py-4 px-5">
                  <div className="flex gap-1.5 justify-end">
                    <button onClick={() => setSelectedVendorForProfile(v)}
                      className="p-2 text-indigo-500 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer" title="View Profile">
                      <User className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => onViewProducts(v.uid, v.storeName || v.displayName || v.email)}
                      className="p-2 text-blue-500 hover:bg-blue-100 rounded-lg transition-colors cursor-pointer" title="View Products">
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    {v.status !== 'approved' && (
                      <button onClick={() => setConfirmAction({ type: 'approve', uid: v.uid, storeName: v.storeName || v.displayName || v.email })}
                        className="p-2 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors cursor-pointer" title="Approve">
                        <CheckCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {v.status !== 'rejected' && (
                      <button onClick={() => setConfirmAction({ type: 'reject', uid: v.uid, storeName: v.storeName || v.displayName || v.email })}
                        className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition-colors cursor-pointer" title="Reject">
                        <XCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      <PaginationBar page={page} totalPages={totalPages} total={total} pageSize={10} setPage={setPage} />

      {confirmAction && confirmAction.type === 'approve' && (
        <ConfirmActionModal
          title="Approve Vendor?"
          description={`Vendor: ${confirmAction.storeName}`}
          warningText="This will approve the vendor to start selling on MedoxAtoZ."
          warningPoints={[
            "The vendor will be authorized to access the vendor portal",
            "They will be able to add and edit their products in the store"
          ]}
          confirmWord="CONFIRM"
          actionButtonLabel="Approve Vendor"
          actionButtonLabelAnyway="Approve Anyway"
          onConfirm={() => {
            onApprove(confirmAction.uid);
            setConfirmAction(null);
          }}
          onCancel={() => setConfirmAction(null)}
          variant="success"
        />
      )}

      {confirmAction && confirmAction.type === 'reject' && (
        <ConfirmActionModal
          title="Reject Vendor?"
          description={`Vendor: ${confirmAction.storeName}`}
          warningText="⚠️ Rejecting this vendor will restrict their store access."
          warningPoints={[
            "Their products will be hidden from the catalog",
            "They will see their application as rejected in their dashboard"
          ]}
          confirmWord="CONFIRM"
          actionButtonLabel="Reject Vendor"
          actionButtonLabelAnyway="Reject Anyway"
          onConfirm={() => {
            onReject(confirmAction.uid);
            setConfirmAction(null);
          }}
          onCancel={() => setConfirmAction(null)}
          variant="danger"
        />
      )}

      {selectedVendorForProfile && (
        <VendorProfileModal
          preFetchedVendor={selectedVendorForProfile}
          onClose={() => setSelectedVendorForProfile(null)}
        />
      )}
    </div>
  );
}
