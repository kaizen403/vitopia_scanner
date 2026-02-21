"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { getOrder, Order } from "@/lib/api";

export default function TicketPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  async function loadOrder() {
    setLoading(true);
    try {
      const data = await getOrder(orderId);
      setOrder(data);
    } catch (error) {
      console.error("Failed to load order:", error);
    } finally {
      setLoading(false);
    }
  }

  // Styled QR image served directly from backend
  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const qrImageUrl = `${API_BASE}/api/orders/${orderId}/qr-image`;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Ticket Not Found
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Order ID: {orderId}
          </p>
          <Link href="/events" className="text-indigo-600 hover:underline">
            Browse Events
          </Link>
        </div>
      </div>
    );
  }

  const event = order.event;
  const date = event ? new Date(event.date) : null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/events" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Your Ticket</h1>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
          {/* Event Header */}
          <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-6 text-white">
            <h2 className="text-2xl font-bold mb-2">{event?.name || "Event"}</h2>
            {date && (
              <div className="flex items-center gap-2 text-white/90">
                <Calendar className="w-4 h-4" />
                <span>
                  {date.toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}{" "}
                  at{" "}
                  {date.toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            )}
            {event?.venue && (
              <div className="flex items-center gap-2 text-white/90 mt-1">
                <MapPin className="w-4 h-4" />
                <span>{event.venue}</span>
              </div>
            )}
          </div>

          {/* QR Code */}
          <div className="p-6 flex flex-col items-center border-b border-gray-100 dark:border-gray-700">
            {order.checkedIn ? (
              <div className="text-center">
                <div className="w-40 h-40 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center mb-4">
                  <CheckCircle className="w-20 h-20 text-green-500" />
                </div>
                <p className="text-lg font-semibold text-green-600 dark:text-green-400">
                  Already Checked In
                </p>
                {order.checkedInAt && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {new Date(order.checkedInAt).toLocaleString()}
                  </p>
                )}
              </div>
            ) : order.paymentStatus === "paid" ? (
              <>
                <div className="bg-[#0A0A0A] p-4 rounded-xl shadow-inner">
                  <img
                    src={qrImageUrl}
                    alt="Ticket QR Code"
                    className="w-64 h-64 rounded-lg"
                  />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-4 text-center">
                  Show this QR code at the entry gate
                </p>
              </>
            ) : (
              <div className="text-center">
                <div className="w-40 h-40 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center mb-4">
                  <Clock className="w-20 h-20 text-yellow-500" />
                </div>
                <p className="text-lg font-semibold text-yellow-600 dark:text-yellow-400">
                  Payment Pending
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Complete payment to get your QR code
                </p>
              </div>
            )}
          </div>

          {/* Ticket Details */}
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Order ID</span>
                <span className="font-mono font-medium text-gray-900 dark:text-white">
                  {order.orderId}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Quantity</span>
                <span className="font-medium text-gray-900 dark:text-white">
                  {order.quantity} ticket(s)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Status</span>
                <span
                  className={`font-medium ${
                    order.checkedIn
                      ? "text-green-600 dark:text-green-400"
                      : order.paymentStatus === "paid"
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-yellow-600 dark:text-yellow-400"
                  }`}
                >
                  {order.checkedIn
                    ? "Checked In"
                    : order.paymentStatus === "paid"
                    ? "Valid"
                    : "Pending Payment"}
                </span>
              </div>
              {order.user && (
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Attendee</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {order.user.name}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          Keep this ticket handy for entry verification
        </p>
      </main>
    </div>
  );
}
