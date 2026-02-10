"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  Search,
  ChevronDown,
  LogOut,
} from "lucide-react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "development" ? "http://localhost:3001" : "");

interface EventAnalytics {
  eventId: string;
  eventName: string;
  sold: number;
  checkedIn: number;
  remaining: number;
  capacity: number;
}

interface Analytics {
  totalTicketsSold: number;
  totalCheckedIn: number;
  totalRemaining: number;
  events: EventAnalytics[];
}

interface ScanLog {
  orderId: string;
  scanResult: string;
  scannedBy: string;
  gate: string;
  timestamp: number;
  eventName: string;
  userName: string;
  userEmail: string;
}

interface DashboardData {
  analytics: Analytics;
  scanLogs: ScanLog[];
}

const RESULT_STYLES: Record<string, { label: string; bg: string; text: string }> = {
  success: { label: "Success", bg: "bg-[#1a2e00]", text: "text-[#9AE600]" },
  already_used: { label: "Already Used", bg: "bg-[#2d1f05]", text: "text-[#f59e0b]" },
  not_found: { label: "Not Found", bg: "bg-[#2d0a0a]", text: "text-[#ef4444]" },
  not_paid: { label: "Not Paid", bg: "bg-[#2d0a0a]", text: "text-[#ef4444]" },
  invalid: { label: "Invalid", bg: "bg-[#2d0a0a]", text: "text-[#ef4444]" },
  wrong_event: { label: "Wrong Event", bg: "bg-[#2d1f05]", text: "text-[#f59e0b]" },
};

function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterEvent, setFilterEvent] = useState("all");
  const [filterResult, setFilterResult] = useState("all");

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch { /* ignore */ }
    router.push("/login");
  };

  const loadData = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/dashboard/data`, {
        credentials: "include",
      });
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const json = await res.json();
      if (json.success) {
        setData(json.data);
        setError("");
      } else {
        setError(json.error || "Failed to load");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [loadData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-[#9AE600] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => { setLoading(true); loadData(); }}
            className="px-6 py-2 bg-[#1a1a1a] border border-[#1a1a1a] text-white rounded-xl hover:border-[#333]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { analytics, scanLogs } = data;

  const filteredLogs = scanLogs.filter((log) => {
    if (filterEvent !== "all" && log.eventName !== filterEvent) return false;
    if (filterResult !== "all" && log.scanResult !== filterResult) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        log.orderId.toLowerCase().includes(q) ||
        log.userName.toLowerCase().includes(q) ||
        log.userEmail.toLowerCase().includes(q) ||
        log.scannedBy.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const eventNames = [...new Set(scanLogs.map((l) => l.eventName))].filter(Boolean);
  const resultTypes = [...new Set(scanLogs.map((l) => l.scanResult))];

  return (
    <div className="min-h-screen bg-black">
      <header className="sticky top-0 z-10 bg-black/80 backdrop-blur-xl border-b border-[#1a1a1a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="p-2 hover:bg-[#1a1a1a] rounded-xl transition-colors">
              <ArrowLeft className="w-5 h-5 text-[#99A1AF]" />
            </Link>
            <div>
              <h1 className="font-heading text-xl tracking-wide text-white">SCAN DASHBOARD</h1>
              <p className="text-xs text-[#99A1AF]">VITopia &apos;26</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setLoading(true); loadData(); }}
              className="p-2.5 hover:bg-[#1a1a1a] rounded-xl transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-5 h-5 text-[#99A1AF] ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={handleLogout}
              className="p-2.5 hover:bg-[#1a1a1a] rounded-xl transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5 text-[#99A1AF]" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {analytics.events.length > 0 && (
          <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl p-5">
            <h2 className="font-heading text-lg tracking-wide text-white mb-4">
              PER-EVENT BREAKDOWN
            </h2>
            <div className="space-y-4">
              {analytics.events.map((ev) => {
                const pct = ev.sold > 0 ? Math.round((ev.checkedIn / ev.sold) * 100) : 0;
                return (
                  <div key={ev.eventId}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-white font-medium">{ev.eventName}</span>
                      <span className="text-xs text-[#99A1AF]">
                        {ev.checkedIn}/{ev.sold} checked in · {ev.remaining} remaining
                      </span>
                    </div>
                    <div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#9AE600] rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#99A1AF]" />
            <input
              type="text"
              placeholder="Search by name, email, order ID, scanner..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl text-white text-sm placeholder:text-[#555] outline-none focus:border-[#9AE600]/50"
            />
          </div>
          <div className="relative">
            <select
              value={filterEvent}
              onChange={(e) => setFilterEvent(e.target.value)}
              className="appearance-none w-full sm:w-44 pl-4 pr-10 py-2.5 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl text-white text-sm outline-none focus:border-[#9AE600]/50"
            >
              <option value="all">All Events</option>
              {eventNames.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#99A1AF] pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={filterResult}
              onChange={(e) => setFilterResult(e.target.value)}
              className="appearance-none w-full sm:w-40 pl-4 pr-10 py-2.5 bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl text-white text-sm outline-none focus:border-[#9AE600]/50"
            >
              <option value="all">All Results</option>
              {resultTypes.map((r) => (
                <option key={r} value={r}>
                  {RESULT_STYLES[r]?.label || r}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#99A1AF] pointer-events-none" />
          </div>
        </div>

        <div className="bg-[#0a0a0a] border border-[#1a1a1a] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#1a1a1a] flex items-center justify-between">
            <h2 className="font-heading text-lg tracking-wide text-white">SCAN HISTORY</h2>
            <span className="text-xs text-[#99A1AF]">{filteredLogs.length} entries</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#1a1a1a] text-[#99A1AF] text-xs uppercase tracking-wider">
                  <th className="text-left px-5 py-3 font-medium">Time</th>
                  <th className="text-left px-5 py-3 font-medium">User</th>
                  <th className="text-left px-5 py-3 font-medium">Order ID</th>
                  <th className="text-left px-5 py-3 font-medium">Event</th>
                  <th className="text-left px-5 py-3 font-medium">Scanned By</th>
                  <th className="text-left px-5 py-3 font-medium">Gate</th>
                  <th className="text-left px-5 py-3 font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-[#99A1AF]">
                      {scanLogs.length === 0 ? "No scan logs yet" : "No results match your filters"}
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log, i) => {
                    const style = RESULT_STYLES[log.scanResult] || {
                      label: log.scanResult,
                      bg: "bg-[#1a1a1a]",
                      text: "text-[#99A1AF]",
                    };
                    const time = new Date(log.timestamp);
                    return (
                      <tr
                        key={`${log.orderId}-${log.timestamp}-${i}`}
                        className="border-b border-[#111] hover:bg-[#111] transition-colors"
                      >
                        <td className="px-5 py-3 text-[#99A1AF] whitespace-nowrap">
                          <div>{time.toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</div>
                          <div className="text-xs text-[#666]">
                            {time.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="text-white font-medium">{log.userName || "—"}</div>
                          <div className="text-xs text-[#666] truncate max-w-[180px]">
                            {log.userEmail || "—"}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-[#99A1AF] font-mono text-xs">
                          {log.orderId}
                        </td>
                        <td className="px-5 py-3 text-white whitespace-nowrap">
                          {log.eventName || "—"}
                        </td>
                        <td className="px-5 py-3 text-[#99A1AF]">{log.scannedBy}</td>
                        <td className="px-5 py-3 text-[#99A1AF]">{log.gate}</td>
                        <td className="px-5 py-3">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-lg text-xs font-medium ${style.bg} ${style.text}`}
                          >
                            {style.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return <Dashboard />;
}
