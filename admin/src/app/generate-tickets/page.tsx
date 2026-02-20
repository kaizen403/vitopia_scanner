"use client";

import { useEffect, useState } from "react";
import {
  createUser,
  createOrder,
  payOrder,
  getEvents,
  Event,
} from "@/lib/api";
import {
  ArrowLeft,
  Loader2,
  Ticket,
  CheckCircle2,
  AlertCircle,
  Plus,
  QrCode,
  Copy,
  Check,
} from "lucide-react";

const EVENT_DISPLAY_NAMES: Record<string, string> = {
  "Vitopia2026-Day1": "Pro-Show Day-1",
  "Vitopia2026-Day2": "Pro-Show Day-2",
  "Vitopia2026-Day3": "Pro-Show Day-3",
};

function formatEventName(name: string): string {
  if (EVENT_DISPLAY_NAMES[name]) return EVENT_DISPLAY_NAMES[name];
  const speakerMatch = name.match(/^(Mr\.\s+[\w\s]+?)\s+on\s+/i);
  if (speakerMatch) return `${speakerMatch[1].trim()} Standup`;
  return name;
}

interface GeneratedTicket {
  orderId: string;
  qrCode: string;
  userName: string;
  userEmail: string;
  eventName: string;
  timestamp: number;
}

export default function GenerateTicketsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  // Form state
  const [eventId, setEventId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [registrationId, setRegistrationId] = useState("");
  const [phone, setPhone] = useState("");
  const [college, setCollege] = useState("");
  const [quantity, setQuantity] = useState(1);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<"" | "user" | "order" | "pay" | "done">("");

  // Results
  const [generatedTickets, setGeneratedTickets] = useState<GeneratedTicket[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    getEvents()
      .then((res) => setEvents(res || []))
      .finally(() => setEventsLoading(false));
  }, []);

  const resetForm = () => {
    setName("");
    setEmail("");
    setRegistrationId("");
    setPhone("");
    setCollege("");
    setQuantity(1);
    setError("");
    setStep("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !name.trim() || !email.trim()) return;

    setSubmitting(true);
    setError("");

    try {
      // Step 1: Create or find user
      setStep("user");
      const userResult = await createUser({
        email: email.trim(),
        name: name.trim(),
        phone: phone.trim() || undefined,
        college: college.trim() || undefined,
      });

      if (!userResult) {
        throw new Error("Failed to create user. Please check the details and try again.");
      }

      // Step 2: Create order
      setStep("order");
      const orderResult = await createOrder({
        userId: userResult.userId,
        eventId,
        quantity,
        registrationId: registrationId.trim() || undefined,
      });

      if (!orderResult) {
        throw new Error("Failed to create order. The event may be full or unavailable.");
      }

      // Step 3: Mark as paid + generate QR
      setStep("pay");
      const payResult = await payOrder(orderResult.orderId);

      if (!payResult) {
        throw new Error(
          `Order ${orderResult.orderId} created but payment marking failed. Mark it as paid manually from the Orders page.`
        );
      }

      // Success
      const selectedEvent = events.find((ev) => ev._id === eventId);
      setGeneratedTickets((prev) => [
        {
          orderId: payResult.orderId,
          qrCode: payResult.qrCode,
          userName: name.trim(),
          userEmail: email.trim(),
          eventName: selectedEvent ? formatEventName(selectedEvent.name) : "Unknown Event",
          timestamp: Date.now(),
        },
        ...prev,
      ]);

      setStep("done");
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = (orderId: string) => {
    navigator.clipboard.writeText(orderId);
    setCopiedId(orderId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const stepLabels: Record<string, string> = {
    user: "Creating user...",
    order: "Creating order...",
    pay: "Generating QR & marking paid...",
    done: "Ticket generated!",
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 md:p-12">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <header className="border-b border-[#333] pb-6">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-[#9AE600] hover:text-white transition-colors mb-4 text-sm"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </a>
          <h1 className="text-3xl md:text-4xl font-semibold">Generate Tickets</h1>
          <p className="text-gray-500 mt-1">
            Create new ticket entries and add them to the database
          </p>
        </header>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Event Selector */}
          <div>
            <label className="block text-sm text-gray-400 mb-2">
              Event <span className="text-red-500">*</span>
            </label>
            {eventsLoading ? (
              <div className="flex items-center gap-2 text-gray-500 text-sm py-3">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading events...
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {events.map((ev) => (
                  <button
                    key={ev._id}
                    type="button"
                    onClick={() => setEventId(ev._id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      eventId === ev._id
                        ? "bg-[#9AE600] text-black"
                        : "bg-[#1a1a1a] text-gray-400 hover:text-white border border-[#333] hover:border-[#9AE600]/40"
                    }`}
                  >
                    {formatEventName(ev.name)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* User Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                required
                className="w-full bg-[#111] border border-[#333] rounded-lg px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-[#9AE600] transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
                required
                className="w-full bg-[#111] border border-[#333] rounded-lg px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-[#9AE600] transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Registration Number
              </label>
              <input
                type="text"
                value={registrationId}
                onChange={(e) => setRegistrationId(e.target.value)}
                placeholder="e.g. 22BCE1234"
                className="w-full bg-[#111] border border-[#333] rounded-lg px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-[#9AE600] transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Phone</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 9876543210"
                className="w-full bg-[#111] border border-[#333] rounded-lg px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-[#9AE600] transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">College</label>
              <input
                type="text"
                value={college}
                onChange={(e) => setCollege(e.target.value)}
                placeholder="VIT-AP University"
                className="w-full bg-[#111] border border-[#333] rounded-lg px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-[#9AE600] transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-2">Quantity</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                min={1}
                max={10}
                className="w-full bg-[#111] border border-[#333] rounded-lg px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-[#9AE600] transition-colors"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 bg-red-950/30 border border-red-900/50 text-red-400 px-4 py-3 rounded-lg text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Progress */}
          {submitting && step && (
            <div className="flex items-center gap-3 bg-[#9AE600]/5 border border-[#9AE600]/20 text-[#9AE600] px-4 py-3 rounded-lg text-sm">
              <Loader2 className="w-4 h-4 animate-spin shrink-0" />
              <span>{stepLabels[step] || "Processing..."}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || !eventId || !name.trim() || !email.trim()}
            className="w-full bg-[#9AE600] hover:bg-[#8ad600] text-black font-semibold py-3.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base"
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Plus className="w-5 h-5" />
                Generate Ticket
              </>
            )}
          </button>
        </form>

        {/* Generated Tickets */}
        {generatedTickets.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Ticket className="w-5 h-5 text-[#9AE600]" />
              Recently Generated ({generatedTickets.length})
            </h2>
            <div className="space-y-3">
              {generatedTickets.map((ticket) => (
                <div
                  key={ticket.orderId}
                  className="bg-[#111] border border-[#333] rounded-lg p-4 flex flex-col sm:flex-row items-start gap-4"
                >
                  {/* QR Code */}
                  <div className="bg-white p-2 rounded-lg shrink-0">
                    <img
                      src={ticket.qrCode}
                      alt="QR Code"
                      className="w-20 h-20"
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm text-[#9AE600]">
                        {ticket.orderId}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(ticket.orderId)}
                        className="text-gray-500 hover:text-white transition-colors"
                        title="Copy Order ID"
                      >
                        {copiedId === ticket.orderId ? (
                          <Check className="w-3.5 h-3.5 text-[#9AE600]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                    <p className="text-white text-sm font-medium">
                      {ticket.userName}
                    </p>
                    <p className="text-gray-500 text-xs">{ticket.userEmail}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#9AE600]/10 text-[#9AE600] border border-[#9AE600]/20">
                        {ticket.eventName}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-green-900/20 text-green-400 border border-green-900/50">
                        <CheckCircle2 className="w-3 h-3" /> Paid
                      </span>
                    </div>
                  </div>

                  {/* Download */}
                  <a
                    href={ticket.qrCode}
                    download={`ticket-${ticket.orderId}.png`}
                    className="shrink-0 px-3 py-1.5 bg-[#1a1a1a] border border-[#333] rounded-lg text-sm text-gray-400 hover:text-white hover:border-[#9AE600]/40 transition-all flex items-center gap-1.5"
                  >
                    <QrCode className="w-3.5 h-3.5" /> Download
                  </a>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
