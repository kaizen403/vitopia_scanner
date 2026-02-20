"use client";

import { useEffect, useState, useCallback } from "react";
import {
  listOrders,
  getEvents,
  sendMails,
  Order,
  Event,
  OrderFilter,
  ListOrdersResponse,
  SendMailsResponse
} from "@/lib/api";
import { format } from "date-fns";
import {
  Search,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Mail,
  Send,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Filter
} from "lucide-react";

export default function SendMailsPage() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<OrderFilter>({ limit: 20 });
  const [search, setSearch] = useState("");

  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());

  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<SendMailsResponse | null>(null);

  useEffect(() => {
    getEvents().then(res => setEvents(res || []));
  }, []);

  const fetchOrders = useCallback(async () => {
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
  }, [filter, page]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setFilter(prev => ({ ...prev, search }));
  };

  const toggleSelectAll = () => {
    if (selectedOrderIds.size === orders.length && orders.length > 0) {
      setSelectedOrderIds(new Set());
    } else {
      setSelectedOrderIds(new Set(orders.map(o => o.orderId)));
    }
  };

  const toggleSelectOrder = (orderId: string) => {
    const newSelected = new Set(selectedOrderIds);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrderIds(newSelected);
  };

  const handleSendMails = async () => {
    if (selectedOrderIds.size === 0) return;
    setIsSending(true);
    setSendResult(null);
    try {
      const orderIdsArray = Array.from(selectedOrderIds);
      const res = await sendMails(orderIdsArray);
      if (res) {
        setSendResult(res);
      }
      setSelectedOrderIds(new Set());
      await fetchOrders();
    } catch (err) {
      console.error(err);
      alert("Failed to send mails");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 pb-20 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#9AE600]/10 blur-[120px] rounded-full pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[#9AE600]/10 blur-[120px] rounded-full pointer-events-none -z-10" />

      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 border-b border-zinc-800 pb-6">
        <div>
          <a href="/" className="inline-flex items-center gap-2 text-primary hover:text-white transition-colors mb-4 font-medium text-sm">
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </a>
          <h1 className="text-4xl font-heading tracking-wider text-white">SEND MAILS</h1>
          <p className="text-zinc-400 mt-1 text-sm">Send QR ticket emails to registered attendees</p>
        </div>
        
        <form onSubmit={handleSearch} className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search ID, Name, Email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 bg-[#111] border border-[#333] rounded-lg pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 focus:border-[#9AE600] focus:outline-none"
            />
          </div>

          <select
            value={filter.mailed || ""}
            onChange={(e) => {
              setPage(1);
              setFilter(prev => ({ ...prev, mailed: e.target.value || undefined }));
              setSelectedOrderIds(new Set());
            }}
            className="h-10 bg-[#111] border border-[#333] rounded-lg px-3 text-sm text-white focus:border-[#9AE600] focus:outline-none cursor-pointer"
          >
            <option value="">All Status</option>
            <option value="false">Not Mailed</option>
            <option value="true">Already Mailed</option>
          </select>

          <select
            value={filter.eventId || ""}
            onChange={(e) => {
              setPage(1);
              setFilter(prev => ({ ...prev, eventId: e.target.value || undefined }));
              setSelectedOrderIds(new Set());
            }}
            className="h-10 bg-[#111] border border-[#333] rounded-lg px-3 text-sm text-white focus:border-[#9AE600] focus:outline-none cursor-pointer w-40"
          >
            <option value="">All Events</option>
            {events.map(ev => (
              <option key={ev._id} value={ev._id}>{ev.name}</option>
            ))}
          </select>

          <button type="submit" className="h-10 bg-[#9AE600] text-black px-5 rounded-lg font-medium text-sm hover:bg-[#8ad600] transition-colors whitespace-nowrap">
            Search
          </button>
        </form>
      </header>

      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleSendMails}
            disabled={selectedOrderIds.size === 0 || isSending}
            className="bg-primary text-black px-6 py-3 rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
            Send Mails ({selectedOrderIds.size})
          </button>
          
          <button
            type="button"
            onClick={() => {
              setSelectedOrderIds(new Set());
              fetchOrders();
            }}
            className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        {sendResult && (
          <div className="flex items-center gap-4 bg-zinc-900 border border-zinc-800 rounded-lg p-3 px-5">
            <div className="flex items-center gap-2 text-[#9AE600]">
              <CheckCircle2 className="w-5 h-5" />
              <span className="font-medium">{sendResult.sent} Sent</span>
            </div>
            {sendResult.failed > 0 && (
              <div className="flex items-center gap-2 text-red-400">
                <XCircle className="w-5 h-5" />
                <span className="font-medium">{sendResult.failed} Failed</span>
              </div>
            )}
          </div>
        )}
      </div>

      {isSending && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 max-w-sm w-full text-center shadow-2xl">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
            <h3 className="text-xl font-heading text-white tracking-wider mb-2">SENDING MAILS</h3>
            <p className="text-zinc-400 text-sm">Processing {selectedOrderIds.size} orders...</p>
          </div>
        </div>
      )}

      <div className="bg-zinc-900/40 border border-white/10 rounded-3xl backdrop-blur-xl overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-12 flex justify-center text-primary">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-black/50 text-zinc-400 uppercase font-heading text-xs tracking-wider">
                <tr>
                  <th className="px-6 py-4 w-12 text-center">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-primary focus:ring-primary focus:ring-offset-zinc-900"
                      checked={orders.length > 0 && selectedOrderIds.size === orders.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="px-6 py-4">Order ID / Date</th>
                  <th className="px-6 py-4">User Details</th>
                  <th className="px-6 py-4">Event</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {orders.map((order) => (
                  <tr key={order._id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-6 py-4 text-center">
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-primary focus:ring-primary focus:ring-offset-zinc-900"
                        checked={selectedOrderIds.has(order.orderId)}
                        onChange={() => toggleSelectOrder(order.orderId)}
                      />
                    </td>
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
                        {order.mailed ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#1a2e00] text-[#9AE600] border border-[#9AE600]/20">
                            <CheckCircle2 className="w-3 h-3" /> Mailed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-800/50 text-zinc-400 border border-zinc-700/50">
                            <Mail className="w-3 h-3" /> Not Mailed
                          </span>
                        )}
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
        
        {!loading && totalPages > 1 && (
          <div className="bg-black/30 border-t border-white/5 px-6 py-4 flex items-center justify-between">
            <span className="text-sm text-zinc-400">
              Showing <span className="text-white font-medium">{orders.length > 0 ? (page - 1) * (filter.limit || 20) + 1 : 0}</span> to <span className="text-white font-medium">{Math.min(page * (filter.limit || 20), total)}</span> of <span className="text-white font-medium">{total}</span> results
            </span>
            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1 rounded bg-zinc-800/50 text-zinc-400 hover:text-white hover:bg-zinc-700 disabled:opacity-50 disabled:hover:bg-zinc-800/50 transition-colors border border-white/5"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button 
                type="button"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1 rounded bg-zinc-800/50 text-zinc-400 hover:text-white hover:bg-zinc-700 disabled:opacity-50 disabled:hover:bg-zinc-800/50 transition-colors border border-white/5"
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
