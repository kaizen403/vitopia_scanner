"use client";

import { useEffect, useState, useCallback } from "react";
import {
  listOrders,
  getEvents,
  sendMails,
  fetchAllMatchingOrderIds,
  Order,
  Event,
  OrderFilter,
  SendMailsResponse
} from "@/lib/api";
import { format } from "date-fns";
import {
  Search,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Loader2,
  Mail,
  Send,
  CheckCircle2,
  XCircle,
  RefreshCw,
  X,
  CheckSquare,
  Square,
  SlidersHorizontal,
  Users,
  Calendar,
  CreditCard,
  ScanLine
} from "lucide-react";

const FILTER_DEFAULTS: OrderFilter = { limit: 20 };

function activeFilterCount(filter: OrderFilter): number {
  let count = 0;
  if (filter.paymentStatus) count++;
  if (filter.mailed) count++;
  if (filter.checkedIn) count++;
  if (filter.eventId) count++;
  if (filter.dateFrom) count++;
  if (filter.dateTo) count++;
  return count;
}

export default function SendMailsPage() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<OrderFilter>(FILTER_DEFAULTS);
  const [search, setSearch] = useState("");

  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [isSelectAll, setIsSelectAll] = useState(false);
  const [selectAllLoading, setSelectAllLoading] = useState(false);

  const [filtersOpen, setFiltersOpen] = useState(false);

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

  useEffect(() => {
    setSelectedOrderIds(new Set());
    setIsSelectAll(false);
  }, [filter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setFilter(prev => ({ ...prev, search }));
  };

  const handleSelectAllOnPage = () => {
    if (orders.length > 0 && orders.every(o => selectedOrderIds.has(o.orderId))) {
      setSelectedOrderIds(new Set());
      setIsSelectAll(false);
    } else {
      setSelectedOrderIds(new Set(orders.map(o => o.orderId)));
      setIsSelectAll(false);
    }
  };

  const handleSelectAllMatching = async () => {
    if (isSelectAll) {
      setSelectedOrderIds(new Set());
      setIsSelectAll(false);
      return;
    }
    setSelectAllLoading(true);
    try {
      const allIds = await fetchAllMatchingOrderIds(filter);
      setSelectedOrderIds(new Set(allIds));
      setIsSelectAll(true);
    } catch (err) {
      console.error(err);
    } finally {
      setSelectAllLoading(false);
    }
  };

  const toggleSelectOrder = (orderId: string) => {
    const newSelected = new Set(selectedOrderIds);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
      setIsSelectAll(false);
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
      setIsSelectAll(false);
      await fetchOrders();
    } catch (err) {
      console.error(err);
      alert("Failed to send mails");
    } finally {
      setIsSending(false);
    }
  };

  const clearAllFilters = () => {
    setSearch("");
    setPage(1);
    setFilter(FILTER_DEFAULTS);
    setSelectedOrderIds(new Set());
    setIsSelectAll(false);
  };

  const updateFilter = (key: keyof OrderFilter, value: string | undefined) => {
    setPage(1);
    setFilter(prev => ({ ...prev, [key]: value }));
  };

  const allOnPageSelected = orders.length > 0 && orders.every(o => selectedOrderIds.has(o.orderId));
  const someOnPageSelected = orders.some(o => selectedOrderIds.has(o.orderId));
  const filterCount = activeFilterCount(filter);

  return (
    <div className="min-h-screen bg-black text-white p-6 pb-20 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[#9AE600]/10 blur-[120px] rounded-full pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-[#9AE600]/10 blur-[120px] rounded-full pointer-events-none -z-10" />

      <header className="flex flex-col gap-4 mb-6 border-b border-zinc-800 pb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <a href="/" className="inline-flex items-center gap-2 text-primary hover:text-white transition-colors mb-4 font-medium text-sm">
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </a>
            <h1 className="text-4xl font-heading tracking-wider text-white">SEND MAILS</h1>
            <p className="text-zinc-400 mt-1 text-sm">Send QR ticket emails to registered attendees</p>
          </div>
          
          <form onSubmit={handleSearch} className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-72">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search ID, Name, Email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full h-10 bg-[#111] border border-[#333] rounded-lg pl-10 pr-4 text-sm text-white placeholder:text-zinc-600 focus:border-[#9AE600] focus:outline-none"
              />
            </div>
            <button type="submit" className="h-10 bg-[#9AE600] text-black px-5 rounded-lg font-medium text-sm hover:bg-[#8ad600] transition-colors whitespace-nowrap">
              Search
            </button>
          </form>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFiltersOpen(!filtersOpen)}
            className={`inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium transition-colors border ${
              filtersOpen || filterCount > 0
                ? "bg-[#9AE600]/10 border-[#9AE600]/30 text-[#9AE600]"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700"
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {filterCount > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#9AE600] text-black text-[10px] font-bold">
                {filterCount}
              </span>
            )}
            {filtersOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {filterCount > 0 && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-medium bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Clear all
            </button>
          )}
        </div>

        {filtersOpen && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-zinc-900/60 border border-zinc-800 rounded-xl p-4 mt-1">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                <Mail className="w-3 h-3" /> Mail Status
              </label>
              <select
                value={filter.mailed || ""}
                onChange={(e) => updateFilter("mailed", e.target.value || undefined)}
                className="w-full h-9 bg-[#111] border border-[#333] rounded-lg px-3 text-sm text-white focus:border-[#9AE600] focus:outline-none cursor-pointer"
              >
                <option value="">All</option>
                <option value="false">Not Mailed</option>
                <option value="true">Already Mailed</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                <ScanLine className="w-3 h-3" /> Check-in Status
              </label>
              <select
                value={filter.checkedIn || ""}
                onChange={(e) => updateFilter("checkedIn", e.target.value || undefined)}
                className="w-full h-9 bg-[#111] border border-[#333] rounded-lg px-3 text-sm text-white focus:border-[#9AE600] focus:outline-none cursor-pointer"
              >
                <option value="">All</option>
                <option value="true">Checked In</option>
                <option value="false">Not Checked In</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                <Users className="w-3 h-3" /> Event
              </label>
              <select
                value={filter.eventId || ""}
                onChange={(e) => updateFilter("eventId", e.target.value || undefined)}
                className="w-full h-9 bg-[#111] border border-[#333] rounded-lg px-3 text-sm text-white focus:border-[#9AE600] focus:outline-none cursor-pointer"
              >
                <option value="">All Events</option>
                {events.map(ev => (
                  <option key={ev.id} value={ev.id}>{ev.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5 ">
              <label className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                <Calendar className="w-3 h-3" /> Date Range
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={filter.dateFrom || ""}
                  onChange={(e) => updateFilter("dateFrom", e.target.value || undefined)}
                  className="flex-1 h-9 bg-[#111] border border-[#333] rounded-lg px-2 text-sm text-white focus:border-[#9AE600] focus:outline-none [color-scheme:dark]"
                />
                <span className="text-zinc-600 text-xs">to</span>
                <input
                  type="date"
                  value={filter.dateTo || ""}
                  onChange={(e) => updateFilter("dateTo", e.target.value || undefined)}
                  className="flex-1 h-9 bg-[#111] border border-[#333] rounded-lg px-2 text-sm text-white focus:border-[#9AE600] focus:outline-none [color-scheme:dark]"
                />
              </div>
            </div>
          </div>
        )}
      </header>

      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
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
              setIsSelectAll(false);
              fetchOrders();
            }}
            className="p-3 bg-zinc-900 border border-zinc-800 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>

          <div className="h-8 w-px bg-zinc-800 hidden md:block" />

          <button
            type="button"
            onClick={handleSelectAllMatching}
            disabled={selectAllLoading || total === 0}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
              isSelectAll
                ? "bg-[#9AE600]/10 border-[#9AE600]/30 text-[#9AE600]"
                : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700"
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {selectAllLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : isSelectAll ? (
              <CheckSquare className="w-4 h-4" />
            ) : (
              <Square className="w-4 h-4" />
            )}
            {isSelectAll ? `All ${total} selected` : `Select all ${total} matching`}
          </button>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
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

          {selectedOrderIds.size > 0 && !isSelectAll && (
            <button
              type="button"
              onClick={() => { setSelectedOrderIds(new Set()); setIsSelectAll(false); }}
              className="text-xs text-zinc-500 hover:text-white transition-colors"
            >
              Clear selection
            </button>
          )}
        </div>
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

        {allOnPageSelected && !isSelectAll && total > orders.length && (
          <div className="bg-[#9AE600]/5 border-b border-[#9AE600]/10 px-6 py-3 flex items-center justify-center gap-2 text-sm">
            <span className="text-zinc-300">
              All <span className="text-white font-medium">{orders.length}</span> orders on this page are selected.
            </span>
            <button
              type="button"
              onClick={handleSelectAllMatching}
              disabled={selectAllLoading}
              className="text-[#9AE600] hover:text-white font-medium transition-colors inline-flex items-center gap-1"
            >
              {selectAllLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : null}
              Select all {total} matching orders
            </button>
          </div>
        )}

        {isSelectAll && (
          <div className="bg-[#9AE600]/10 border-b border-[#9AE600]/20 px-6 py-3 flex items-center justify-center gap-2 text-sm">
            <CheckSquare className="w-4 h-4 text-[#9AE600]" />
            <span className="text-white font-medium">
              All {selectedOrderIds.size} matching orders are selected.
            </span>
            <button
              type="button"
              onClick={() => { setSelectedOrderIds(new Set()); setIsSelectAll(false); }}
              className="text-zinc-400 hover:text-white font-medium transition-colors"
            >
              Clear selection
            </button>
          </div>
        )}

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
                    <button
                      type="button"
                      onClick={handleSelectAllOnPage}
                      className="inline-flex items-center justify-center"
                    >
                      {allOnPageSelected && orders.length > 0 ? (
                        <CheckSquare className="w-4.5 h-4.5 text-[#9AE600]" />
                      ) : someOnPageSelected ? (
                        <div className="w-4 h-4 rounded border-2 border-[#9AE600] bg-[#9AE600]/20" />
                      ) : (
                        <Square className="w-4.5 h-4.5 text-zinc-600" />
                      )}
                    </button>
                  </th>
                  <th className="px-6 py-4">Order ID / Date</th>
                  <th className="px-6 py-4">User Details</th>
                  <th className="px-6 py-4">Event</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {orders.map((order) => (
                  <tr key={order.id} className={`transition-colors ${selectedOrderIds.has(order.orderId) ? "bg-[#9AE600]/5" : "hover:bg-zinc-800/30"}`}>
                    <td className="px-6 py-4 text-center">
                      <button
                        type="button"
                        onClick={() => toggleSelectOrder(order.orderId)}
                        className="inline-flex items-center justify-center"
                      >
                        {selectedOrderIds.has(order.orderId) ? (
                          <CheckSquare className="w-4.5 h-4.5 text-[#9AE600]" />
                        ) : (
                          <Square className="w-4.5 h-4.5 text-zinc-600 hover:text-zinc-400" />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-mono text-white text-xs mb-1">{order.orderId}</div>
                      <div className="text-xs text-zinc-500">{order.createdAt ? format(new Date(order.createdAt), "MMM d, yyyy") : "N/A"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-white">{order.user?.name || "Unknown"}</div>
                      <div className="text-xs text-zinc-400">{order.user?.email}</div>
                      {order.user?.phone && <div className="text-xs text-zinc-500">{order.user.phone}</div>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-white max-w-[200px] truncate" title={order.event?.name}>{order.event?.name}</div>
                      <div className="text-xs text-zinc-500">{order.quantity} Ticket(s)</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5 items-start">
                        {order.mailed ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#1a2e00] text-[#9AE600] border border-[#9AE600]/20">
                            <CheckCircle2 className="w-3 h-3" /> Mailed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-800/50 text-zinc-400 border border-zinc-700/50">
                            <Mail className="w-3 h-3" /> Not Mailed
                          </span>
                        )}
                        {order.checkedIn && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-zinc-800/50 text-zinc-300 border border-zinc-700/50">
                            <ScanLine className="w-3 h-3" /> Scanned
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-zinc-500 italic">
                      No orders found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        
        {!loading && totalPages > 0 && (
          <div className="bg-black/30 border-t border-white/5 px-6 py-4 flex items-center justify-between">
            <span className="text-sm text-zinc-400">
              Showing <span className="text-white font-medium">{orders.length > 0 ? (page - 1) * (filter.limit || 20) + 1 : 0}</span> to <span className="text-white font-medium">{Math.min(page * (filter.limit || 20), total)}</span> of <span className="text-white font-medium">{total}</span> results
              {selectedOrderIds.size > 0 && (
                <span className="ml-2 text-[#9AE600]">
                  · {selectedOrderIds.size} selected
                </span>
              )}
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
              <span className="text-sm text-zinc-400 px-2">{page} / {totalPages}</span>
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
