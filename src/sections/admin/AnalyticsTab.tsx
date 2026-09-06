'use client';

import { TrendingUp, ShoppingCart, Truck, DollarSign } from 'lucide-react';

interface AnalyticsTabProps {
  orders: any[];
  isFetching: boolean;
}

const STATUS_STYLES: Record<string, string> = {
  Pending:   'bg-blue-50 text-blue-600 border-blue-200',
  Approved:  'bg-emerald-50 text-emerald-600 border-emerald-200',
  Rejected:  'bg-red-50 text-red-500 border-red-200',
  Delivered: 'bg-purple-50 text-purple-600 border-purple-200',
};

function KPISkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
      <div className="h-3 bg-gray-100 rounded w-24 animate-pulse mb-3" />
      <div className="h-8 bg-gray-100 rounded w-32 animate-pulse mb-1" />
      <div className="h-3 bg-gray-100 rounded w-16 animate-pulse" />
    </div>
  );
}

export default function AnalyticsTab({ orders, isFetching }: AnalyticsTabProps) {
  const totalRevenue = orders.reduce((s, o) => s + (Number(o.totalAmount) || 0), 0);
  const totalOrders = orders.length;
  const deliveredOrders = orders.filter(o => o.status === 'Delivered').length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const statusCounts = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const byMethod = orders.reduce((acc, o) => {
    const method = o.paymentMethod || 'Unknown';
    acc[method] = (acc[method] || 0) + Number(o.totalAmount || 0);
    return acc;
  }, {} as Record<string, number>);

  const kpis = [
    {
      label: 'Total Revenue',
      value: `₹${totalRevenue.toLocaleString('en-IN')}`,
      icon: <DollarSign className="w-5 h-5" />,
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-600',
      bg: 'from-amber-50/50 to-white',
      border: 'border-amber-100',
      valueColor: 'text-amber-600',
    },
    {
      label: 'Total Orders',
      value: totalOrders,
      icon: <ShoppingCart className="w-5 h-5" />,
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-600',
      bg: 'from-blue-50/50 to-white',
      border: 'border-blue-100',
      valueColor: 'text-blue-600',
    },
    {
      label: 'Delivered',
      value: deliveredOrders,
      icon: <Truck className="w-5 h-5" />,
      iconBg: 'bg-purple-500/10',
      iconColor: 'text-purple-600',
      bg: 'from-purple-50/50 to-white',
      border: 'border-purple-100',
      valueColor: 'text-purple-600',
    },
    {
      label: 'Avg. Order Value',
      value: `₹${Math.round(avgOrderValue).toLocaleString('en-IN')}`,
      icon: <TrendingUp className="w-5 h-5" />,
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-600',
      bg: 'from-emerald-50/50 to-white',
      border: 'border-emerald-100',
      valueColor: 'text-emerald-600',
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isFetching ? (
          Array.from({ length: 4 }).map((_, i) => <KPISkeleton key={i} />)
        ) : (
          kpis.map(({ label, value, icon, iconBg, iconColor, bg, border, valueColor }) => (
            <div key={label} className={`bg-gradient-to-br ${bg} rounded-2xl border ${border} p-5 shadow-sm`}>
              <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center mb-3`}>
                <span className={iconColor}>{icon}</span>
              </div>
              <div className={`text-2xl font-extrabold ${valueColor} leading-none mb-1`}>{value}</div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{label}</div>
            </div>
          ))
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Breakdown */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <h3 className="text-sm font-bold text-gray-800">Orders by Status</h3>
          </div>
          <div className="p-5">
            {isFetching ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-3 border-gray-200 border-t-gold-primary rounded-full animate-spin" />
              </div>
            ) : Object.keys(statusCounts).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No data yet</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(statusCounts).map(([status, count]) => {
                  const pct = totalOrders > 0 ? Math.round(((count as number) / totalOrders) * 100) : 0;
                  const barColor: Record<string, string> = {
                    Pending: 'bg-blue-400', Approved: 'bg-emerald-500',
                    Rejected: 'bg-red-400', Delivered: 'bg-purple-500',
                  };
                  return (
                    <div key={status}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${STATUS_STYLES[status] || 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                          {status}
                        </span>
                        <span className="text-sm font-bold text-gray-700">{count as number} <span className="text-gray-400 font-normal text-xs">({pct}%)</span></span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${barColor[status] || 'bg-gray-300'} transition-all duration-700`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Revenue by payment method */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
            <h3 className="text-sm font-bold text-gray-800">Revenue by Payment Method</h3>
          </div>
          <div className="p-5">
            {isFetching ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-3 border-gray-200 border-t-gold-primary rounded-full animate-spin" />
              </div>
            ) : Object.keys(byMethod).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No data yet</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(byMethod).map(([method, total]) => (
                  <div key={method} className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                      <span className="text-sm font-semibold text-gray-700 truncate max-w-[160px]">{method}</span>
                    </div>
                    <span className="font-extrabold text-emerald-600 text-sm flex-shrink-0">
                      ₹{(total as number).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
