"use client";

import { useEffect, useState } from "react";
import {
  createUser,
  createOrder,
  payOrder,
  getEvents,
  sendMails,
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
  Mail,
  MailCheck,
  X,
  Users,
  User,
  DownloadCloud,
} from "lucide-react";

const EVENT_DISPLAY_NAMES: Record<string, string> = {
  "Vitopia2026-Day2": "Day-2 Pro show",
  "Day-2 Pro show": "Day-2 Pro show",
};

function formatEventName(name: string): string {
  if (EVENT_DISPLAY_NAMES[name]) return EVENT_DISPLAY_NAMES[name];
  if (name === "Vitopia2026-Day2") return "Day-2 Pro show";
  if (name === "Day-2 Pro show") return "Day-2 Pro show";
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

  // Modes
  const [mode, setMode] = useState<"single" | "bulk">("single");

  // Form state (Single)
  const [eventId, setEventId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [registrationId, setRegistrationId] = useState("");
  const quantity = 1;

  // Form state (Bulk)
  const [bulkText, setBulkText] = useState("");

  const extractRegNo = (emailStr: string): string => {
    const match = emailStr.match(/\.(\d{2}[a-zA-Z]{2,4}\d{3,5})@/);
    return match ? match[1].toUpperCase() : "";
  };

  const randomPhone = (): string => {
    const prefixes = ["98", "97", "96", "95", "94", "93", "91", "90", "89", "88", "87", "86", "85", "84", "83", "82", "81", "80", "79", "78", "77", "76", "75", "74", "73", "72", "71", "70"];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const rest = Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)).join("");
    return `${prefix}${rest}`;
  };

  const extractEmails = (text: string) => {
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
    const matches = text.match(emailRegex) || [];
    return Array.from(new Set(matches.map(m => m.toLowerCase())));
  };

  const handleEmailChange = (val: string) => {
    setEmail(val);
    const extracted = extractRegNo(val);
    if (extracted) setRegistrationId(extracted);
  };

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [step, setStep] = useState<string>("");

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
    setError("");
    setStep("");
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !name.trim() || !email.trim()) return;

    setSubmitting(true);
    setError("");

    try {
      setStep("Creating user...");
      const userResult = await createUser({
        email: email.trim(),
        name: name.trim(),
        phone: randomPhone(),
        college: "VIT-AP University",
      });

      if (!userResult) throw new Error("Failed to create user");

      setStep("Creating order...");
      const orderResult = await createOrder({
        userId: userResult.userId,
        eventId,
        quantity,
        registrationId: registrationId.trim() || undefined,
      });

      if (!orderResult) throw new Error("Failed to create order");

      setStep("Generating QR & marking paid...");
      const payResult = await payOrder(orderResult.orderId);

      if (!payResult) throw new Error("Payment marking failed");

      const selectedEvent = events.find((ev) => ev.id === eventId);
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

      setStep("Ticket generated!");
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
      setTimeout(() => setStep(""), 2000);
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventId || !bulkText.trim()) return;

    const emails = extractEmails(bulkText);
    if (emails.length === 0) {
      setError("No valid emails found in the pasted text.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const newTickets: GeneratedTicket[] = [];
      const selectedEvent = events.find((ev) => ev.id === eventId);
      const evName = selectedEvent ? formatEventName(selectedEvent.name) : "Unknown Event";

      for (let i = 0; i < emails.length; i++) {
        const mail = emails[i];
        setStep(`Processing ${i + 1}/${emails.length}... (${mail})`);

        try {
          const userResult = await createUser({
            email: mail,
            name: mail, // Name is email as requested
            phone: randomPhone(),
            college: "VIT-AP University",
          });
          if (!userResult) throw new Error("Failed to create user");

          const orderResult = await createOrder({
            userId: userResult.userId,
            eventId,
            quantity: 1,
            registrationId: undefined, // No reg no
          });
          if (!orderResult) throw new Error("Failed to create order");

          const payResult = await payOrder(orderResult.orderId);
          if (!payResult) throw new Error("Failed to mark paid");

          newTickets.push({
            orderId: payResult.orderId,
            qrCode: payResult.qrCode,
            userName: mail,
            userEmail: mail,
            eventName: evName,
            timestamp: Date.now(),
          });
        } catch (innerErr) {
          console.error(`Failed for ${mail}`, innerErr);
        }
      }

      setGeneratedTickets((prev) => [...newTickets, ...prev]);
      setStep(`Generated ${newTickets.length} tickets successfully!`);
      setBulkText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
      setTimeout(() => setStep(""), 3000);
    }
  };

  const handleCopy = (orderId: string) => {
    navigator.clipboard.writeText(orderId);
    setCopiedId(orderId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const [sendingMailFor, setSendingMailFor] = useState<string | null>(null);
  const [mailedTickets, setMailedTickets] = useState<Set<string>>(new Set());
  const [massMailing, setMassMailing] = useState(false);

  const handleSendMail = async (orderId: string) => {
    if (sendingMailFor || mailedTickets.has(orderId)) return;
    setSendingMailFor(orderId);
    try {
      await sendMails([orderId]);
      setMailedTickets(new Set(mailedTickets).add(orderId));
    } catch (err) {
      alert("Failed to send email. You can try again from the Send Mails page.");
    } finally {
      setSendingMailFor(null);
    }
  };

  const handleMassMailAll = async () => {
    const unmailed = generatedTickets.filter(t => !mailedTickets.has(t.orderId));
    if (unmailed.length === 0) {
      alert("All visible tickets have already been mailed.");
      return;
    }

    if (!confirm(`Are you sure you want to mass mail ${unmailed.length} tickets?`)) return;

    setMassMailing(true);
    try {
      const orderIds = unmailed.map(t => t.orderId);

      const CHUNK_SIZE = 20;
      for (let i = 0; i < orderIds.length; i += CHUNK_SIZE) {
        const chunk = orderIds.slice(i, i + CHUNK_SIZE);
        await sendMails(chunk);
      }

      const newMailed = new Set(mailedTickets);
      orderIds.forEach(id => newMailed.add(id));
      setMailedTickets(newMailed);
      alert("Mass mail completed successfully!");
    } catch (err) {
      alert("Failed mass mail. Please try again.");
    } finally {
      setMassMailing(false);
    }
  };

  const handleDownloadAll = async () => {
    if (generatedTickets.length === 0) return;
    if (!confirm(`Are you sure you want to download ${generatedTickets.length} QR codes?`)) return;

    for (let i = 0; i < generatedTickets.length; i++) {
      const ticket = generatedTickets[i];
      const a = document.createElement("a");
      a.href = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api/orders/${ticket.orderId}/qr-image`;
      a.download = `ticket-${ticket.orderId}.png`;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      await new Promise(r => setTimeout(r, 200));
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6 md:p-12 pb-24">
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

        {/* Mode Toggle */}
        <div className="flex bg-[#111] p-1 rounded-lg border border-[#333] max-w-sm">
          <button
            onClick={() => setMode("single")}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 ${mode === "single" ? "bg-[#9AE600] text-black shadow" : "text-gray-400 hover:text-white"
              }`}
          >
            <User className="w-4 h-4" /> Single
          </button>
          <button
            onClick={() => setMode("bulk")}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors flex items-center justify-center gap-2 ${mode === "bulk" ? "bg-[#9AE600] text-black shadow" : "text-gray-400 hover:text-white"
              }`}
          >
            <Users className="w-4 h-4" /> Bulk Import
          </button>
        </div>

        {/* Form */}
        <form onSubmit={mode === "single" ? handleSingleSubmit : handleBulkSubmit} className="space-y-6">
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
                {events.filter(ev => ev.isActive && ev.accessToken === "DAY_2").map((ev) => (
                  <button
                    key={ev.id}
                    type="button"
                    onClick={() => setEventId(ev.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${eventId === ev.id
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

          {mode === "single" ? (
            /* User Details - Single */
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
                  onChange={(e) => handleEmailChange(e.target.value)}
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
            </div>
          ) : (
            /* Bulk Paste Area */
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                Paste Emails <span className="text-red-500">*</span>
              </label>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder="Paste text containing emails, e.g.&#10;pujitha.23bce20090@vitapstudent.ac.in&#10;sreenivasulu.23bce20188@vitapstudent.ac.in"
                rows={8}
                required
                className="w-full bg-[#111] border border-[#333] rounded-lg px-4 py-3 text-white placeholder:text-gray-600 focus:outline-none focus:border-[#9AE600] transition-colors resize-y"
              />
              <p className="text-xs text-gray-500 mt-2">
                Emails will be auto-detected. The email will be used as the name, and registration number will be empty.
                Detected: {extractEmails(bulkText).length} email(s).
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 bg-red-950/30 border border-red-900/50 text-red-400 px-4 py-3 rounded-lg text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Progress */}
          {step && (
            <div className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm ${submitting ? "bg-[#9AE600]/5 border border-[#9AE600]/20 text-[#9AE600]" : "bg-zinc-800/50 border border-zinc-700 text-zinc-300"}`}>
              {submitting && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
              {!submitting && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />}
              <span>{step}</span>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || !eventId || (mode === "single" ? (!name.trim() || !email.trim()) : !bulkText.trim())}
            className="w-full bg-[#9AE600] hover:bg-[#8ad600] text-black font-semibold py-3.5 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base"
          >
            {submitting ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Plus className="w-5 h-5" />
                {mode === "single" ? "Generate Ticket" : `Generate ${extractEmails(bulkText).length > 0 ? extractEmails(bulkText).length : "Bulk"} Tickets`}
              </>
            )}
          </button>
        </form>

        {/* Generated Tickets */}
        {generatedTickets.length > 0 && (
          <section className="mt-12 pt-8 border-t border-[#333]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Ticket className="w-5 h-5 text-[#9AE600]" />
                Generated Tickets ({generatedTickets.length})
              </h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleMassMailAll}
                  disabled={massMailing || generatedTickets.every(t => mailedTickets.has(t.orderId))}
                  className="px-4 py-2 bg-[#1a1a1a] border border-[#333] rounded-lg text-sm text-gray-300 hover:text-white hover:border-[#9AE600]/40 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {massMailing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                  Mass Mail All
                </button>
                <button
                  type="button"
                  onClick={handleDownloadAll}
                  className="px-4 py-2 bg-[#1a1a1a] border border-[#333] rounded-lg text-sm text-gray-300 hover:text-white hover:border-[#9AE600]/40 transition-all flex items-center justify-center gap-2"
                >
                  <DownloadCloud className="w-4 h-4" /> Download All
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {generatedTickets.map((ticket, i) => (
                <div
                  key={`${ticket.orderId}-${i}`}
                  className="bg-[#111] border border-[#333] rounded-lg p-4 flex flex-col sm:flex-row items-start gap-4"
                >
                  {/* QR Code */}
                  <div className="bg-[#0A0A0A] p-2 rounded-lg shrink-0">
                    <img
                      src={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api/orders/${ticket.orderId}/qr-image`}
                      alt="QR Code"
                      className="w-20 h-20 rounded"
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
                    </div>
                  </div>

                  <div className="flex flex-row sm:flex-col gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setGeneratedTickets((prev) => prev.filter((t) => t.orderId !== ticket.orderId))}
                      className="px-2 py-1.5 bg-[#1a1a1a] border border-[#333] rounded-lg text-sm text-gray-500 hover:text-red-400 hover:border-red-900/40 transition-all flex items-center justify-center"
                      title="Dismiss"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSendMail(ticket.orderId)}
                      disabled={sendingMailFor === ticket.orderId || mailedTickets.has(ticket.orderId)}
                      className="px-3 py-1.5 bg-[#1a1a1a] border border-[#333] rounded-lg text-sm text-gray-400 hover:text-white hover:border-[#9AE600]/40 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {sendingMailFor === ticket.orderId ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : mailedTickets.has(ticket.orderId) ? (
                        <MailCheck className="w-3.5 h-3.5 text-[#9AE600]" />
                      ) : (
                        <Mail className="w-3.5 h-3.5" />
                      )}
                      {mailedTickets.has(ticket.orderId) ? "Sent" : "Send Mail"}
                    </button>
                    <a
                      href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/api/orders/${ticket.orderId}/qr-image`}
                      download={`ticket-${ticket.orderId}.png`}
                      className="px-3 py-1.5 bg-[#1a1a1a] border border-[#333] rounded-lg text-sm text-gray-400 hover:text-white hover:border-[#9AE600]/40 transition-all flex items-center justify-center gap-1.5"
                    >
                      <QrCode className="w-3.5 h-3.5" /> Download
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

