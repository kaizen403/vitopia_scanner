"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  Ticket,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { getEvent, createUser, createOrder, payOrder, Event } from "@/lib/api";

export default function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"details" | "register" | "payment" | "success">("details");
  const [quantity, setQuantity] = useState(1);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    college: "",
  });
  const [orderId, setOrderId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    loadEvent();
  }, [id]);

  async function loadEvent() {
    setLoading(true);
    try {
      const data = await getEvent(id);
      setEvent(data);
      if (data?.type === "WORKSHOP" && data.slots?.length) {
        setSelectedSlotId(data.slots[0].id);
      }
    } catch (error) {
      console.error("Failed to load event:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    if (!event) return;

    if (event.type === "WORKSHOP" && !selectedSlotId) {
      alert("Please select a workshop slot.");
      return;
    }

    setProcessing(true);
    try {
      // Create or get user
      const userResult = await createUser(formData);
      if (!userResult) {
        alert("Failed to register. Please try again.");
        return;
      }

      // Create order
      const orderResult = await createOrder({
        userId: userResult.userId,
        eventId: event.id,
        slotId: event.type === "WORKSHOP" ? selectedSlotId : undefined,
        quantity,
      });

      if (!orderResult) {
        alert("Failed to create order. Please try again.");
        return;
      }

      setOrderId(orderResult.orderId);
      setStep("payment");
    } catch (error) {
      console.error("Registration error:", error);
      alert("An error occurred. Please try again.");
    } finally {
      setProcessing(false);
    }
  }

  async function handlePayment() {
    if (!orderId) return;

    setProcessing(true);
    try {
      const result = await payOrder(orderId);
      if (!result) {
        alert("Payment failed. Please try again.");
        return;
      }

      setQrCode(result.qrCode);
      setStep("success");
    } catch (error: any) {
      console.error("Payment error:", error);
      alert(error.message || "An error occurred. Please try again.");
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Event Not Found
          </h1>
          <Link href="/events" className="text-indigo-600 hover:underline">
            Back to Events
          </Link>
        </div>
      </div>
    );
  }

  const date = new Date(event.date);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link href="/events" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">
              {event.name}
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {step === "details" && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden">
            <div className="h-48 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <Calendar className="w-20 h-20 text-white/80" />
            </div>
            <div className="p-8">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
                {event.name}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {event.description}
              </p>

              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Date & Time</p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {date.toLocaleDateString("en-US", {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                    <p className="text-gray-600 dark:text-gray-400">
                      {date.toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Venue</p>
                    <p className="font-medium text-gray-900 dark:text-white">{event.venue}</p>
                  </div>
                </div>
              </div>

              {event.type === "WORKSHOP" && event.slots && (
                <div className="mb-8 p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800">
                  <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    Select Workshop Slot
                  </h4>
                  <div className="grid gap-4">
                    {event.slots.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => setSelectedSlotId(slot.id)}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${selectedSlotId === slot.id
                            ? "border-indigo-600 bg-white dark:bg-gray-800 shadow-md ring-2 ring-indigo-600 ring-opacity-10"
                            : "border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 hover:border-indigo-300"
                          }`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-bold text-gray-900 dark:text-white">
                              {new Date(slot.startTime).toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                              })} - {new Date(slot.endTime).toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {slot.capacity} available slots
                            </p>
                          </div>
                          {selectedSlotId === slot.id && (
                            <CheckCircle className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Price per ticket</p>
                    <p className="text-3xl font-bold text-indigo-600 dark:text-indigo-400">
                      ${(event.price / 100).toFixed(2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-gray-600 dark:text-gray-400">Quantity:</label>
                    <select
                      value={quantity}
                      onChange={(e) => setQuantity(parseInt(e.target.value))}
                      className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg mb-6">
                  <span className="text-gray-600 dark:text-gray-400">Total</span>
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    ${((event.price * quantity) / 100).toFixed(2)}
                  </span>
                </div>

                <button
                  onClick={() => setStep("register")}
                  className="w-full py-4 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-semibold text-lg flex items-center justify-center gap-2"
                >
                  <Ticket className="w-5 h-5" />
                  Get Tickets
                </button>
              </div>
            </div>
          </div>
        )}

        {step === "register" && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Registration Details
            </h2>
            <form onSubmit={handleRegister} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter your full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter your email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter your phone number"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  College/Organization
                </label>
                <input
                  type="text"
                  value={formData.college}
                  onChange={(e) => setFormData({ ...formData, college: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="Enter your college or organization"
                />
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setStep("details")}
                  className="flex-1 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={processing}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {processing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Continue to Payment"
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {step === "payment" && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Payment
            </h2>
            <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-lg mb-6">
              <div className="flex justify-between mb-4">
                <span className="text-gray-600 dark:text-gray-400">Event</span>
                <span className="font-medium text-gray-900 dark:text-white">{event.name}</span>
              </div>
              <div className="flex justify-between mb-4">
                <span className="text-gray-600 dark:text-gray-400">Quantity</span>
                <span className="font-medium text-gray-900 dark:text-white">{quantity} ticket(s)</span>
              </div>
              <div className="flex justify-between mb-4">
                <span className="text-gray-600 dark:text-gray-400">Order ID</span>
                <span className="font-mono text-gray-900 dark:text-white">{orderId}</span>
              </div>
              <div className="border-t border-gray-200 dark:border-gray-600 pt-4 flex justify-between">
                <span className="text-lg font-semibold text-gray-900 dark:text-white">Total</span>
                <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
                  ${((event.price * quantity) / 100).toFixed(2)}
                </span>
              </div>
            </div>

            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center">
              This is a demo. Click "Pay Now" to simulate a successful payment.
            </p>

            <button
              onClick={handlePayment}
              disabled={processing}
              className="w-full py-4 bg-green-600 text-white rounded-xl hover:bg-green-700 font-semibold text-lg flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {processing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Processing Payment...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Pay Now
                </>
              )}
            </button>
          </div>
        )}

        {step === "success" && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Payment Successful!
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Your tickets have been purchased. Show the QR code below at the entry gate.
            </p>

            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg mb-6">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Order ID</p>
              <p className="font-mono text-lg text-gray-900 dark:text-white">{orderId}</p>
            </div>

            <div className="flex gap-4">
              <Link
                href={`/ticket/${orderId}`}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium"
              >
                View Ticket
              </Link>
              <Link
                href="/events"
                className="flex-1 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-medium"
              >
                Browse More Events
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
