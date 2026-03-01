"use client";

import { useEffect, useState } from "react";
import { listOrders, updateOrder, deleteOrder, OrderFilter, ListOrdersResponse, Order, getEvents, Event } from "@/lib/api";
import { format } from "date-fns";
import { Search, ChevronLeft, ChevronRight, Edit2, Trash2, ArrowLeft, Loader2, Save, X } from "lucide-react";

export default function OrdersPage() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<OrderFilter>({ limit: 20 });
  const [search, setSearch] = useState("");

  const [editOrder, setEditOrder] = useState<Order | null>(null);

  useEffect(() => {
    getEvents().then(res => setEvents(res || []));
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const res = await listOrders({ ...filter, page });
      if (res) {
        setOrders(res.orders);
        setTotal(res.total);
        setTotalPages(res.totalPages);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [filter, page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setFilter(prev => ({ ...prev, search }));
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editOrder) return;
    try {
      await updateOrder(editOrder.orderId, {
        paymentStatus: editOrder.paymentStatus,
        checkedIn: editOrder.checkedIn,
        quantity: editOrder.quantity
      });
      setEditOrder(null);
      fetchOrders();
    } catch (err) {
      alert("Failed to update order");
    }
  };

  const handleDelete = async (orderId: string) => {
    if (!confirm("Are you sure you want to delete this order?")) return;
    try {
      await deleteOrder(orderId);
      fetchOrders();
    } catch (err) {
      alert("Failed to delete order");
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-zinc-800 pb-6">
        <div>
          <a href="/" className="inline-flex items-center gap-2 text-primary hover:text-white transition-colors mb-4 font-medium text-sm">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </a>
          <h1 className="text-4xl font-heading text-white">ORDER MANAGEMENT</h1>
          <p className="text-zinc-400 mt-1 text-sm">View, filter and manage all registrations</p>
        </div>
        
        <form onSubmit={handleSearch} className="flex gap-2 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Search ID, Name, Email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:border-primary focus:outline-none transition-colors"
            />
          </div>
          <select
            value={filter.paymentStatus || ""}
            onChange={(e) => {
              setPage(1);
              setFilter(prev => ({ ...prev, paymentStatus: e.target.value || undefined }));
            }}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
          <select
            value={filter.eventId || ""}
            onChange={(e) => {
              setPage(1);
              setFilter(prev => ({ ...prev, eventId: e.target.value || undefined }));
            }}
            className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white max-w-[150px] focus:border-primary focus:outline-none"
          >
            <option value="">All Events</option>
            {events.map(ev => (
              <option key={ev.id} value={ev.id}>{ev.name}</option>
            ))}
          </select>
          <button type="submit" className="bg-primary text-black px-4 py-2 rounded-lg font-medium text-sm hover:bg-primary-dark transition-colors">
            Search
          </button>
        </form>
      </header>

      {/* Edit Modal */}
      {editOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-2xl relative">
            <button onClick={() => setEditOrder(null)} className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-heading text-white mb-2">EDIT ORDER</h2>
            <div className="font-mono text-sm text-primary mb-6 bg-primary/10 px-3 py-1.5 rounded inline-block">{editOrder.orderId}</div>
            
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">Status</label>
                <select
                  value={editOrder.paymentStatus}
                  onChange={(e) => setEditOrder({...editOrder, paymentStatus: e.target.value as any})}
                  className="w-full bg-black border border-zinc-800 rounded-lg px-3 py-2 text-white focus:border-primary focus:outline-none"
                >
                  <option value="paid">Paid</option>
                  <option value="pending">Pending</option>
                  <option value="failed">Failed</option>
                  <option value="refunded">Refunded</option>
                </select>
              </div>
              
              <div className="flex items-center justify-between p-3 bg-black border border-zinc-800 rounded-lg mt-4">
                <div>
                  <div className="text-sm text-white font-medium">Scan Status</div>
                  <div className="text-xs text-zinc-500">Toggle check-in status</div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={editOrder.checkedIn}
                    onChange={(e) => setEditOrder({...editOrder, checkedIn: e.target.checked})}
                  />
                  <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-zinc-800">
                <button type="button" onClick={() => setEditOrder(null)} className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-primary text-black font-medium rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2">
                  <Save className="w-4 h-4" /> Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 flex justify-center text-primary">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-black text-zinc-400 uppercase font-heading text-xs tracking-wider">
                <tr>
                  <th className="px-6 py-4">Order ID / Date</th>
                  <th className="px-6 py-4">User Details</th>
                  <th className="px-6 py-4">Event</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-zinc-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-mono text-white text-xs mb-1">{order.orderId}</div>
                      <div className="text-xs text-zinc-500">{order.createdAt ? format(new Date(order.createdAt), "MMM d, yyyy") : "N/A"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{order.user?.name || "Unknown"}</div>
                      <div className="text-xs text-zinc-400">{order.user?.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-white max-w-[200px] truncate" title={order.event?.name}>{order.event?.name}</div>
                      <div className="text-xs text-zinc-500">{order.quantity} Ticket(s)</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2 items-start">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          order.paymentStatus === "paid" ? "bg-primary/10 text-primary border-primary/20" : 
                          order.paymentStatus === "pending" ? "bg-yellow-900/20 text-yellow-500 border-yellow-900/50" : 
                          "bg-red-900/20 text-red-400 border-red-900/50"
                        }`}>
                          {order.paymentStatus}
                        </span>
                        {order.checkedIn && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-800 text-zinc-300 border border-zinc-700">
                            Scanned In
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setEditOrder(order)} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors" title="Edit">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(order.orderId)} className="p-2 text-red-500 hover:text-red-400 hover:bg-red-950/30 rounded-lg transition-colors" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-zinc-500 italic">
                      No orders found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="bg-black/50 border-t border-zinc-800 px-6 py-4 flex items-center justify-between">
            <span className="text-sm text-zinc-400">
              Showing <span className="text-white font-medium">{orders.length > 0 ? (page - 1) * (filter.limit || 20) + 1 : 0}</span> to <span className="text-white font-medium">{Math.min(page * (filter.limit || 20), total)}</span> of <span className="text-white font-medium">{total}</span> results
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-50 transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1 rounded bg-zinc-800 text-zinc-400 hover:text-white disabled:opacity-50 transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
