"use client";

import React, { useState, useEffect } from "react";
import { 
  QrCode,
  Activity,
  Mail,
  Lock,
  Loader2,
  ShieldCheck,
  ArrowRight,
  ClipboardList
} from "lucide-react";
import { 
  authenticateDashboard, 
  getDashboardData, 
  DashboardData 
} from "@/lib/api";

const EVENT_DISPLAY_NAMES: Record<string, string> = {
  "Vitopia2026-Day1": "Pro-Show Day-1",
  "Vitopia2026-Day2": "Pro-Show Day-2",
  "Vitopia2026-Day3": "Pro-Show Day-3",
};

function formatEventName(name: string): string {
  if (EVENT_DISPLAY_NAMES[name]) return EVENT_DISPLAY_NAMES[name];
  // "Mr. Pranav Sharma on 22 Feb 2026 from 2.30 PM to 3.30 PM" → "Mr. Pranav Sharma Standup"
  const speakerMatch = name.match(/^(Mr\.\s+[\w\s]+?)\s+on\s+/i);
  if (speakerMatch) return `${speakerMatch[1].trim()} Standup`;
  return name;
}

export default function AdminDashboard() {
  const [token, setToken] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState<string>("all");

  useEffect(() => {
    const savedToken = localStorage.getItem("adminToken");
    if (savedToken) {
      setToken(savedToken);
    } else {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    setDataLoading(true);

    getDashboardData(token)
      .then((data) => {
        if (!isMounted) return;
        if (data) {
          setDashboardData(data);
        } else {
          localStorage.removeItem("adminToken");
          setToken(null);
        }
      })
      .catch((err) => {
        console.error(err);
        if (isMounted) {
          localStorage.removeItem("adminToken");
          setToken(null);
        }
      })
      .finally(() => {
        if (isMounted) setDataLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    
    try {
      const resToken = await authenticateDashboard(pin);
      if (resToken) {
        localStorage.setItem("adminToken", resToken);
        setToken(resToken);
      } else {
        setAuthError("Invalid PIN");
      }
    } catch (err) {
      setAuthError("Authentication failed");
    } finally {
      setAuthLoading(false);
    }
  };

  if (dataLoading && !dashboardData) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center font-sans selection:bg-[#9AE600] selection:text-black">
        <Loader2 className="w-8 h-8 text-[#9AE600] animate-spin" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center p-6">
        <div className="w-full max-w-sm bg-[#111] border border-[#333] p-8 rounded-lg">
          <div className="flex justify-center mb-6">
            <Lock className="w-8 h-8 text-[#9AE600]" />
          </div>
          
          <h1 className="text-2xl font-semibold text-center mb-2">
            Admin Login
          </h1>
          <p className="text-gray-400 text-center mb-6 text-sm">
            Enter PIN to continue
          </p>

          <form onSubmit={handleAuth} className="space-y-4">
            <input
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="6-digit PIN"
              minLength={6}
              maxLength={6}
              className="w-full bg-[#1a1a1a] border border-[#333] rounded px-4 py-3 text-center text-lg focus:outline-none focus:border-[#9AE600] text-white placeholder:text-gray-600"
              required
            />
            
            {authError && (
              <p className="text-red-500 text-sm text-center">
                {authError}
              </p>
            )}

            <button
              type="submit"
              disabled={authLoading || !pin}
              className="w-full bg-[#9AE600] hover:bg-[#8ad600] text-black font-medium py-3 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {authLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Login"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const { analytics } = dashboardData || {
    analytics: { totalTicketsSold: 0, totalCheckedIn: 0, totalRemaining: 0, events: [] }
  };

  const filteredEvents = selectedEventId === "all"
    ? analytics.events
    : analytics.events.filter((e) => e.eventId === selectedEventId);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 md:p-12">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-[#333] pb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-semibold mb-1">
              Admin Dashboard
            </h1>
            <p className="text-gray-500 text-base">Event management & analytics</p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center gap-4">
            <button 
              type="button"
              onClick={() => {
                localStorage.removeItem("adminToken");
                setToken(null);
              }}
              className="text-sm text-gray-400 hover:text-white px-4 py-2 bg-[#1a1a1a] rounded border border-[#333]"
            >
              Log Out
            </button>
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <div className="w-2 h-2 rounded-full bg-[#9AE600]" />
              Online
            </div>
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a
            href="/generate-tickets"
            className="group flex items-center gap-4 bg-[#9AE600] hover:bg-[#8ad600] text-black px-6 py-4 rounded-lg font-semibold text-lg transition-all active:scale-[0.98]"
          >
            <QrCode className="w-6 h-6 shrink-0" />
            <div>
              <span className="block">Generate Tickets</span>
              <span className="block text-sm font-normal text-black/60">Generate and download QR tickets</span>
            </div>
            <ArrowRight className="w-5 h-5 ml-auto opacity-60 group-hover:translate-x-1 transition-transform" />
          </a>

          <a
            href="/send-mails"
            className="group flex items-center gap-4 bg-white/10 hover:bg-white/15 border border-white/10 hover:border-[#9AE600]/40 text-white px-6 py-4 rounded-lg font-semibold text-lg transition-all active:scale-[0.98]"
          >
            <Mail className="w-6 h-6 text-[#9AE600] shrink-0" />
            <div>
              <span className="block">Send Emails</span>
              <span className="block text-sm font-normal text-gray-400">Send QR ticket emails to attendees</span>
            </div>
            <ArrowRight className="w-5 h-5 ml-auto text-[#9AE600] opacity-60 group-hover:translate-x-1 transition-transform" />
          </a>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#111] border border-[#333] p-6 rounded-lg">
            <p className="text-gray-500 text-sm mb-2">Total Tickets Sold</p>
            <p className="text-3xl font-semibold">{analytics.totalTicketsSold}</p>
          </div>
          <div className="bg-[#111] border border-[#333] p-6 rounded-lg">
            <p className="text-gray-500 text-sm mb-2">Total Checked In</p>
            <p className="text-3xl font-semibold">{analytics.totalCheckedIn}</p>
          </div>
          <div className="bg-[#111] border border-[#333] p-6 rounded-lg">
            <p className="text-gray-500 text-sm mb-2">Total Remaining</p>
            <p className="text-3xl font-semibold">{analytics.totalRemaining}</p>
          </div>
        </section>

        <section>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5 text-[#9AE600]" />
              Event Analytics
            </h2>
            {analytics.events.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedEventId("all")}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                    selectedEventId === "all"
                      ? "bg-[#9AE600] text-black"
                      : "bg-[#1a1a1a] text-gray-400 hover:text-white border border-[#333]"
                  }`}
                >
                  All Events
                </button>
                {analytics.events.map((event) => (
                  <button
                    type="button"
                    key={event.eventId}
                    onClick={() => setSelectedEventId(event.eventId)}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                      selectedEventId === event.eventId
                        ? "bg-[#9AE600] text-black"
                        : "bg-[#1a1a1a] text-gray-400 hover:text-white border border-[#333]"
                    }`}
                  >
                    {formatEventName(event.eventName)}
                  </button>
                ))}
              </div>
            )}
          </div>
          {filteredEvents.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredEvents.map((event) => (
                <AnalyticsCard 
                  key={event.eventId}
                  day={formatEventName(event.eventName)} 
                  scanned={event.checkedIn} 
                  entered={event.checkedIn} 
                  total={event.sold} 
                />
              ))}
            </div>
          ) : (
            <div className="bg-[#111] border border-[#333] p-8 rounded-lg text-center">
              <ShieldCheck className="w-10 h-10 text-gray-600 mx-auto mb-2" />
              <p className="text-gray-400">No event data available</p>
            </div>
          )}
        </section>

        <section className="bg-[#111] border border-[#333] p-6 rounded-lg flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <ClipboardList className="w-8 h-8 text-[#9AE600]" />
            <div>
              <h2 className="text-xl font-semibold">Orders</h2>
              <p className="text-gray-500 text-sm">
                View and manage registrations
              </p>
            </div>
          </div>
          <a 
            href="/orders" 
            className="w-full sm:w-auto px-6 py-3 bg-[#9AE600] text-black font-medium rounded hover:bg-[#8ad600] transition-colors"
          >
            View Orders
          </a>
        </section>
      </div>
    </div>
  );
}

function AnalyticsCard({ day, scanned, entered, total }: { day: string, scanned: number, entered: number, total: number }) {
  const scanPct = total > 0 ? Math.round((scanned / total) * 100) : 0;
  const enterPct = total > 0 ? Math.round((entered / total) * 100) : 0;

  return (
    <div className="bg-[#111] border border-[#333] p-5 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-medium">{day}</h3>
        <span className="text-xs text-gray-500">{total} total</span>
      </div>
      
      <div className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-400">Scanned</span>
            <span className="text-gray-500">{scanned} / {total} ({scanPct}%)</span>
          </div>
          <div className="h-2 w-full bg-[#1a1a1a] rounded overflow-hidden">
            <div className="h-full bg-gray-400" style={{ width: `${scanPct}%` }} />
          </div>
        </div>

        <div>
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-400">Entered</span>
            <span className="text-gray-500">{entered} / {total} ({enterPct}%)</span>
          </div>
          <div className="h-2 w-full bg-[#1a1a1a] rounded overflow-hidden">
            <div className="h-full bg-[#9AE600]" style={{ width: `${enterPct}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
