import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Clock, 
  MapPin, 
  Copy, 
  Check, 
  RefreshCw, 
  ChevronRight, 
  ExternalLink,
  ShoppingBag,
  Filter
} from 'lucide-react';
import { BookOrder, Product } from '../types';
import { getCustomerSession } from '../lib/customerAuth';

interface CustomerOrdersViewProps {
  onBackToHome: () => void;
  onOrderAgain: (product: Product) => void;
}

export default function CustomerOrdersView({
  onBackToHome,
  onOrderAgain
}: CustomerOrdersViewProps) {
  const [session, setSession] = useState(getCustomerSession());
  const [orders, setOrders] = useState<BookOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchOrders = async () => {
    const currentSession = getCustomerSession();
    setSession(currentSession);
    setLoading(true);

    let list: BookOrder[] = [];
    const queryPhone = currentSession?.phone || localStorage.getItem('customer_session_phone') || '';

    if (queryPhone) {
      try {
        const res = await fetch(`/api/orders/track?q=${encodeURIComponent(queryPhone)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.orders)) {
            list = data.orders;
          }
        }
      } catch (err) {
        console.warn('Failed to fetch orders from server:', err);
      }
    }

    // Fallback: check local storage orders
    if (list.length === 0) {
      try {
        const local = localStorage.getItem('noor_book_orders');
        if (local) {
          const parsed = JSON.parse(local);
          if (Array.isArray(parsed)) {
            list = parsed.filter((o: any) => {
              if (!queryPhone) return true;
              const p = (o.phone || '').replace(/\D/g, '');
              return p.includes(queryPhone.slice(-8));
            });
          }
        }
      } catch {}
    }

    setOrders(list);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleCopy = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredOrders = orders.filter(o => {
    if (statusFilter === 'all') return true;
    return (o.status || '').toLowerCase() === statusFilter.toLowerCase();
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-6">
      
      {/* Breadcrumb matching Arogga */}
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        <button 
          type="button" 
          onClick={onBackToHome}
          className="hover:text-slate-800 transition cursor-pointer"
        >
          Home
        </button>
        <ChevronRight className="w-3.5 h-3.5" />
        <span className="text-slate-900 font-bold">Orders</span>
      </div>

      {/* Tabs & Filters matching Screenshot 4 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-6">
          <button 
            type="button"
            className="text-base font-black text-teal-800 border-b-2 border-teal-700 pb-2 -mb-4 tracking-tight"
          >
            Store Orders ({orders.length})
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              <option value="all">All</option>
              <option value="Pending">Pending</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Processing">Processing</option>
              <option value="Shipped">Shipped</option>
              <option value="Delivered">Delivered</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>

          <button
            type="button"
            onClick={fetchOrders}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            title="Refresh orders"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Order Cards List matching Screenshot 4 */}
      {loading ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-8 h-8 border-2 border-teal-700 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs font-medium text-slate-500">Loading your orders...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-8 space-y-4 shadow-2xs">
          <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center mx-auto">
            <Package className="w-7 h-7" />
          </div>
          <h3 className="text-base font-black text-slate-900">No Orders Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            You don't have any orders under this filter. Explore our shop and place your first order!
          </p>
          <button
            type="button"
            onClick={onBackToHome}
            className="px-6 py-2.5 bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-sm transition active:scale-95 cursor-pointer inline-flex items-center gap-2"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Continue Shopping</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const dateStr = order.createdAt 
              ? new Date(order.createdAt).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                  hour12: true
                })
              : 'Recent Order';

            const statusColor = 
              order.status === 'Delivered' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
              order.status === 'Confirmed' ? 'bg-teal-50 text-teal-700 border-teal-200' :
              order.status === 'Shipped' ? 'bg-blue-50 text-blue-700 border-blue-200' :
              order.status === 'Cancelled' ? 'bg-rose-50 text-rose-700 border-rose-200' :
              'bg-amber-50 text-amber-700 border-amber-200';

            return (
              <div 
                key={order.id}
                className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-2xs hover:border-slate-300 transition space-y-4"
              >
                {/* Top Row: Order ID + Regular Delivery Badge */}
                <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">Order ID:</span>
                    <span className="font-mono text-xs sm:text-sm font-black text-slate-900">
                      #{order.id.replace(/^ORD-/, '')}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(order.id)}
                      className="p-1 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                      title="Copy Order ID"
                    >
                      {copiedId === order.id ? <Check className="w-3.5 h-3.5 text-teal-700" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>

                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold">
                    <Package className="w-3.5 h-3.5 text-teal-700" />
                    <span>Regular Delivery</span>
                  </span>
                </div>

                {/* Middle Row: Customer Info, Address & Date + Price */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                      <MapPin className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5">
                      <h4 className="text-sm font-black text-slate-900">
                        {order.customerName || order.name || 'Customer'}
                      </h4>
                      <p className="text-xs font-mono text-slate-600">
                        {order.phone || order.customerPhone}
                      </p>
                      <p className="text-xs text-slate-600 max-w-lg leading-relaxed">
                        {order.address}
                      </p>
                    </div>
                  </div>

                  {/* Date & Price */}
                  <div className="text-left md:text-right space-y-1">
                    <p className="text-xs text-slate-500 font-mono">
                      Date: <span className="font-bold text-slate-700">{dateStr}</span>
                    </p>
                    <div className="flex items-baseline gap-1 md:justify-end">
                      <span className="text-base sm:text-lg font-black text-slate-900 font-mono">
                        ৳{Number(order.totalPrice || 0).toLocaleString()}
                      </span>
                      <span className="text-xs font-bold text-amber-600">
                        ({order.paymentMethod === 'COD' ? 'Unpaid' : 'Paid'})
                      </span>
                    </div>
                  </div>
                </div>

                {/* Bottom Row: Status Badge & Order Again Action */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">Status:</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-black border ${statusColor}`}>
                      {order.status || 'Pending'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (order.productId && order.product) {
                        onOrderAgain(order.product);
                      } else {
                        onBackToHome();
                      }
                    }}
                    className="px-4 py-2 border border-teal-700 text-teal-800 hover:bg-teal-50 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer"
                  >
                    Order Again
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Footer hint matching Arogga */}
      <p className="text-center text-xs text-slate-400 pt-6">
        You've reached the end
      </p>

    </div>
  );
}