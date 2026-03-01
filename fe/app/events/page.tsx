"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Calendar, MapPin, Users, Ticket, ArrowLeft } from "lucide-react";
import { getEvents, Event } from "@/lib/api";

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, []);

  async function loadEvents() {
    setLoading(true);
    try {
      const data = await getEvents();
      setEvents(data);
    } catch (error) {
      console.error("Failed to load events:", error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Events</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-20">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No Events Yet
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Check back later for upcoming events.
            </p>
            <Link
              href="/admin"
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Create Event (Admin)
            </Link>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function EventCard({ event }: { event: Event }) {
  const date = new Date(event.date);
  const formattedDate = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const formattedTime = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden hover:shadow-xl transition-shadow">
      <div className="h-32 bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
        <Calendar className="w-12 h-12 text-white/80" />
      </div>
      <div className="p-6">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            {event.name}
          </h3>
          {event.type === "WORKSHOP" && (
            <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-full uppercase tracking-wider">
              Workshop
            </span>
          )}
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
          {event.description}
        </p>
        <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>{formattedDate} at {formattedTime}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4" />
            <span>{event.venue}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>Capacity: {event.capacity}</span>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            ${(event.price / 100).toFixed(2)}
          </span>
          <Link
            href={`/events/${event.id}`}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
          >
            <Ticket className="w-4 h-4" />
            Get Tickets
          </Link>
        </div>
      </div>
    </div>
  );
}
