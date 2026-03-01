"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  BarChart3,
  Users,
  Ticket,
  DollarSign,
  Calendar,
  MapPin,
  RefreshCw,
  TrendingUp,
  XCircle,
} from "lucide-react";
import {
  getEvents,
  getEventStats,
  Event,
  EventStats,
} from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
const API_KEY = process.env.NEXT_PUBLIC_PRAANA_API_KEY || "";

export default function AdminPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    date: "",
    time: "",
    venue: "",
    capacity: 100,
    price: 0,
    type: "EVENT" as "EVENT" | "WORKSHOP",
    slots: [] as { startTime: string; endTime: string; capacity: number }[],
  });

  useEffect(() => {
    loadEvents();
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      loadStats(selectedEvent);
      const interval = setInterval(() => loadStats(selectedEvent), 5000);
      return () => clearInterval(interval);
    }
  }, [selectedEvent]);

  async function loadEvents() {
    setLoading(true);
    try {
      const data = await getEvents();
      setEvents(data);
      if (data.length > 0 && !selectedEvent) {
        setSelectedEvent(data[0].id);
      }
    } catch (error) {
      console.error("Failed to load events:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadStats(eventId: string) {
    try {
      const data = await getEventStats(eventId);
      setStats(data);
    } catch (error) {
      console.error("Failed to load stats:", error);
    }
  }

  function handleAddSlot() {
    setFormData({
      ...formData,
      slots: [...formData.slots, { startTime: "", endTime: "", capacity: 50 }],
    });
  }

  function handleRemoveSlot(index: number) {
    setFormData({
      ...formData,
      slots: formData.slots.filter((_, i) => i !== index),
    });
  }

  async function handleCreateEvent(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);

    try {
      const dateTime = new Date(`${formData.date}T${formData.time}`).getTime();

      const payloadSlots = formData.slots.map(s => ({
        startTime: new Date(`${formData.date}T${s.startTime}`).getTime(),
        endTime: new Date(`${formData.date}T${s.endTime}`).getTime(),
        capacity: s.capacity,
      }));

      const response = await fetch(`${API_URL}/api/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": API_KEY
        },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description,
          date: dateTime,
          venue: formData.venue,
          capacity: formData.capacity,
          price: Math.round(formData.price * 100),
          type: formData.type,
          slots: formData.type === "WORKSHOP" ? payloadSlots : undefined,
        }),
      });

      if (response.ok) {
        setShowCreateForm(false);
        setFormData({
          name: "",
          description: "",
          date: "",
          time: "",
          venue: "",
          capacity: 100,
          price: 0,
          type: "EVENT",
          slots: [],
        });
        await loadEvents();
      } else {
        alert("Failed to create event");
      }
    } catch (error) {
      console.error("Create event error:", error);
      alert("Failed to create event");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Admin Dashboard
              </h1>
            </div>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Create Event
            </button>
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
              Create your first event to get started.
            </p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Create Event
            </button>
          </div>
        ) : (
          <div className="grid lg:grid-cols-4 gap-8">
            {/* Event List */}
            <div className="lg:col-span-1">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Events
              </h2>
              <div className="space-y-2">
                {events.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => setSelectedEvent(event.id)}
                    className={`w-full text-left p-4 rounded-xl transition-colors ${selectedEvent === event.id
                      ? "bg-indigo-100 dark:bg-indigo-900/30 border-2 border-indigo-500"
                      : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-indigo-300"
                      }`}
                  >
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {event.name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      {new Date(event.date).toLocaleDateString()}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Stats Dashboard */}
            <div className="lg:col-span-3">
              {stats ? (
                <>
                  {/* Event Header */}
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 mb-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                          {stats.event.name}
                        </h2>
                        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            {new Date(stats.event.date).toLocaleDateString()}
                          </div>
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {stats.event.venue}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => selectedEvent && loadStats(selectedEvent)}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                        title="Refresh stats"
                      >
                        <RefreshCw className="w-5 h-5 text-gray-500" />
                      </button>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <StatCard
                      icon={<Ticket className="w-6 h-6" />}
                      label="Tickets Sold"
                      value={stats.totalTicketsSold}
                      color="indigo"
                    />
                    <StatCard
                      icon={<Users className="w-6 h-6" />}
                      label="Checked In"
                      value={stats.totalCheckedIn}
                      color="green"
                    />
                    <StatCard
                      icon={<DollarSign className="w-6 h-6" />}
                      label="Revenue"
                      value={`$${(stats.totalRevenue / 100).toFixed(0)}`}
                      color="yellow"
                    />
                    <StatCard
                      icon={<BarChart3 className="w-6 h-6" />}
                      label="Capacity Left"
                      value={stats.capacityRemaining}
                      color="blue"
                    />
                  </div>

                  {/* Slot-specific stats if Workshop */}
                  {stats.slotStats && stats.slotStats.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 mb-6">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Workshop Slots breakdown
                      </h3>
                      <div className="grid gap-4 sm:grid-cols-2">
                        {stats.slotStats.map((slot) => (
                          <div
                            key={slot.slotId}
                            className="p-4 rounded-xl border border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50"
                          >
                            <div className="flex justify-between items-center mb-2">
                              <span className="font-bold text-gray-900 dark:text-white">
                                {new Date(slot.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(slot.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                              <span className={`text-xs font-bold px-2 py-1 rounded-full ${slot.remaining > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {slot.remaining} Left
                              </span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-500">Sold: {slot.sold}</span>
                              <span className="text-gray-500">
                                {Math.round((slot.sold / (slot.sold + slot.remaining)) * 100)}% Full
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Progress Bar */}
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Check-in Progress
                    </h3>
                    <div className="relative h-8 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-green-500 transition-all duration-500"
                        style={{
                          width: `${stats.totalTicketsSold > 0
                            ? (stats.totalCheckedIn / stats.totalTicketsSold) * 100
                            : 0
                            }%`,
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center text-sm font-medium">
                        {stats.totalCheckedIn} / {stats.totalTicketsSold} checked in
                        {stats.totalTicketsSold > 0 && (
                          <span className="ml-2 text-gray-500">
                            (
                            {Math.round(
                              (stats.totalCheckedIn / stats.totalTicketsSold) * 100
                            )}
                            %)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Capacity Progress */}
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                      Ticket Sales
                    </h3>
                    <div className="relative h-8 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="absolute inset-y-0 left-0 bg-indigo-500 transition-all duration-500"
                        style={{
                          width: `${stats.event.capacity > 0
                            ? (stats.totalTicketsSold / stats.event.capacity) * 100
                            : 0
                            }%`,
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-center text-sm font-medium">
                        {stats.totalTicketsSold} / {stats.event.capacity} sold
                        {stats.event.capacity > 0 && (
                          <span className="ml-2 text-gray-500">
                            (
                            {Math.round(
                              (stats.totalTicketsSold / stats.event.capacity) * 100
                            )}
                            %)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-20">
                  <p className="text-gray-500 dark:text-gray-400">
                    Select an event to view statistics
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Create Event Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Create New Event
              </h2>
            </div>
            <form onSubmit={handleCreateEvent} className="p-6 space-y-4">
              <div className="flex gap-4 p-1 bg-gray-100 dark:bg-gray-900 rounded-xl">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: "EVENT" })}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${formData.type === "EVENT"
                    ? "bg-white dark:bg-gray-800 shadow text-indigo-600"
                    : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                  Regular Event
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, type: "WORKSHOP" })}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${formData.type === "WORKSHOP"
                    ? "bg-white dark:bg-gray-800 shadow text-indigo-600"
                    : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                  Workshop
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {formData.type === "WORKSHOP" ? "Workshop Name *" : "Event Name *"}
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder={formData.type === "WORKSHOP" ? "AI & Robotics Workshop" : "Annual Tech Fest"}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description *
                </label>
                <textarea
                  required
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={3}
                  placeholder="Describe your event..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Default Start Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {formData.type === "WORKSHOP" && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                      Schedule Slots
                    </label>
                    <button
                      type="button"
                      onClick={handleAddSlot}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
                    >
                      <Plus className="w-4 h-4" /> Add Slot
                    </button>
                  </div>
                  <div className="space-y-2">
                    {formData.slots.length === 0 && (
                      <p className="text-xs text-gray-500 italic">No slots added yet. Workshops need at least one slot.</p>
                    )}
                    {formData.slots.map((slot, index) => (
                      <div key={index} className="flex gap-2 items-end p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-700">
                        <div className="flex-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Start</label>
                          <input
                            type="time"
                            required
                            value={slot.startTime}
                            onChange={(e) => {
                              const newSlots = [...formData.slots];
                              newSlots[index].startTime = e.target.value;
                              setFormData({ ...formData, slots: newSlots });
                            }}
                            className="w-full px-2 py-1 bg-transparent text-sm border-b border-gray-300 focus:border-indigo-500"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase">End</label>
                          <input
                            type="time"
                            required
                            value={slot.endTime}
                            onChange={(e) => {
                              const newSlots = [...formData.slots];
                              newSlots[index].endTime = e.target.value;
                              setFormData({ ...formData, slots: newSlots });
                            }}
                            className="w-full px-2 py-1 bg-transparent text-sm border-b border-gray-300 focus:border-indigo-500"
                          />
                        </div>
                        <div className="w-20">
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Cap</label>
                          <input
                            type="number"
                            required
                            value={slot.capacity}
                            onChange={(e) => {
                              const newSlots = [...formData.slots];
                              newSlots[index].capacity = parseInt(e.target.value);
                              setFormData({ ...formData, slots: newSlots });
                            }}
                            className="w-full px-2 py-1 bg-transparent text-sm border-b border-gray-300 focus:border-indigo-500"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveSlot(index)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Venue *
                </label>
                <input
                  type="text"
                  required
                  value={formData.venue}
                  onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Main Auditorium"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Capacity *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.capacity}
                    onChange={(e) =>
                      setFormData({ ...formData, capacity: parseInt(e.target.value) })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Price ($) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) =>
                      setFormData({ ...formData, price: parseFloat(e.target.value) })
                    }
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="flex-1 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || (formData.type === "WORKSHOP" && formData.slots.length === 0)}
                  className="flex-1 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {creating ? "Creating..." : "Create Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color: "indigo" | "green" | "yellow" | "blue";
}) {
  const colorClasses = {
    indigo: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400",
    green: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
    yellow: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-400",
    blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-100 dark:border-gray-700">
      <div
        className={`w-12 h-12 rounded-lg flex items-center justify-center mb-4 ${colorClasses[color]}`}
      >
        {icon}
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
        {value}
      </p>
    </div>
  );
}
