const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (process.env.NODE_ENV === "development" ? "http://localhost:3001" : "");

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("API Error:", error);
    return {
      success: false,
      error: "Network error. Please try again.",
    };
  }
}

// Events
export interface Event {
  _id: string;
  name: string;
  description: string;
  date: number;
  venue: string;
  capacity: number;
  price: number;
  isActive: boolean;
  accessToken?: string | null;
  category?: string;
  scanOrder?: number;
  createdAt: number;
}

export async function getEvents(): Promise<Event[]> {
  const response = await fetchApi<Event[]>("/api/events");
  return response.data || [];
}

export async function getEvent(id: string): Promise<Event | null> {
  const response = await fetchApi<Event>(`/api/events/${id}`);
  return response.data || null;
}

export interface EventStats {
  event: Event;
  totalTicketsSold: number;
  totalCheckedIn: number;
  totalRevenue: number;
  capacityRemaining: number;
}

export async function getEventStats(id: string): Promise<EventStats | null> {
  const response = await fetchApi<EventStats>(`/api/events/${id}/stats`);
  return response.data || null;
}

// Users
export interface User {
  _id: string;
  email: string;
  name: string;
  phone?: string;
  college?: string;
}

export async function createUser(data: {
  email: string;
  name: string;
  phone?: string;
  college?: string;
}): Promise<{ userId: string } | null> {
  const response = await fetchApi<{ userId: string }>("/api/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
  return response.data || null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const response = await fetchApi<User>(`/api/users/email/${encodeURIComponent(email)}`);
  return response.data || null;
}

// Orders
export interface Order {
  _id: string;
  orderId: string;
  userId: string;
  eventId: string;
  quantity: number;
  totalAmount: number;
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  checkedIn: boolean;
  checkedInAt?: number;
  mailed: boolean;
  createdAt?: number;
  event?: Event;
  user?: User;
  qrCode?: string;
}

export async function createOrder(data: {
  userId: string;
  eventId: string;
  quantity: number;
  registrationId?: string;
  accessTokens?: string[];
}): Promise<{ id: string; orderId: string; totalAmount: number } | null> {
  const response = await fetchApi<{ id: string; orderId: string; totalAmount: number }>(
    "/api/orders",
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
  return response.data || null;
}

export async function payOrder(
  orderId: string
): Promise<{ orderId: string; qrCode: string } | null> {
  const response = await fetchApi<{ orderId: string; qrCode: string }>(
    `/api/orders/${orderId}/pay`,
    { method: "POST" }
  );
  return response.data || null;
}

export async function getOrder(orderId: string): Promise<Order | null> {
  const response = await fetchApi<Order>(`/api/orders/${orderId}`);
  return response.data || null;
}

// Scanning
export interface ScanResult {
  success: boolean;
  message?: string;
  error?: string;
  code: string;
  data?: {
    orderId: string;
    quantity: number;
    receiptId?: string | null;
    invoiceNumber?: string | null;
    registrationId?: string | null;
    productMeta?: string | null;
    accessTokens?: string[];
    tshirt?: {
      eligible: boolean;
      size: string | null;
      color: string | null;
    };
    user?: { name: string; email: string } | null;
    event?: { name: string; venue: string } | null;
  };
  checkedInAt?: number;
  createdAt?: number;
  checkedInBy?: string;
  responseTime?: number;
}

export async function verifyTicket(
  qrCode: string,
  gateId: string,
  eventId?: string
): Promise<ScanResult> {
  const response = await fetch(`${API_URL}/api/scan/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Gate-Id": gateId,
    },
    body: JSON.stringify({ qrCode, eventId }),
  });

  return response.json();
}

export async function validateTicket(
  qrCode: string,
  gateId: string
): Promise<ScanResult> {
  const response = await fetch(`${API_URL}/api/scan/validate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Gate-Id": gateId,
    },
    body: JSON.stringify({ qrCode }),
  });

  return response.json();
}

export interface ScanStats {
  activeScans: number;
  recentScansPerMinute: number;
  totalTicketsSold: number;
  totalCheckedIn: number;
  totalRevenue: number;
  capacityRemaining: number;
  event: Event;
}

export async function getScanStats(eventId: string): Promise<ScanStats | null> {
  const response = await fetchApi<ScanStats>(`/api/scan/stats/${eventId}`);
  return response.data || null;
}

export interface TicketHistoryEvent {
  id: string;
  name: string;
  accessToken: string | null;
  category: string;
}

export interface TicketHistoryScanEntry {
  scanResult: string;
  scannedBy: string;
  gate: string;
  timestamp: number;
  event: TicketHistoryEvent | null;
}

export interface TicketHistoryData {
  orderId: string;
  user: { name: string; email: string } | null;
  purchasedEvents: TicketHistoryEvent[];
  lastScannedAt: number | null;
  scanHistory: TicketHistoryScanEntry[];
}

export interface TicketHistoryResponse {
  success: boolean;
  data?: TicketHistoryData;
  error?: string;
  code?: string;
}

export async function lookupTicketHistory(
  qrCode: string,
  gateId: string
): Promise<TicketHistoryResponse> {
  const response = await fetch(`${API_URL}/api/scan/history`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Gate-Id": gateId,
    },
    body: JSON.stringify({ qrCode }),
  });

  return response.json();
}

// Dashboard
export interface DashboardData {
  analytics: {
    totalTicketsSold: number;
    totalCheckedIn: number;
    totalRemaining: number;
    events: {
      eventId: string;
      eventName: string;
      sold: number;
      checkedIn: number;
      remaining: number;
      capacity: number;
    }[];
  };
  scanLogs: {
    orderId: string;
    scanResult: string;
    scannedBy: string;
    gate: string;
    timestamp: number;
    eventName: string;
    userName: string;
    userEmail: string;
  }[];
}

export async function getDashboardData(token: string): Promise<DashboardData | null> {
  const response = await fetchApi<DashboardData>("/api/dashboard/data", {
    headers: { Authorization: `Bearer ${token}` }
  });
  return response.data || null;
}

export async function authenticateDashboard(pin: string): Promise<string | null> {
  const response = await fetchApi<string>("/api/dashboard/auth", {
    method: "POST",
    body: JSON.stringify({ pin })
  });
  return response.data || null;
}

// Orders management
export interface OrderFilter {
  search?: string;
  paymentStatus?: string;
  eventId?: string;
  mailed?: string;
  page?: number;
  limit?: number;
}

export interface ListOrdersResponse {
  orders: Order[];
  total: number;
  page: number;
  totalPages: number;
}

export async function listOrders(filter: OrderFilter): Promise<ListOrdersResponse | null> {
  const params = new URLSearchParams();
  if (filter.search) params.append("search", filter.search);
  if (filter.paymentStatus) params.append("paymentStatus", filter.paymentStatus);
  if (filter.eventId) params.append("eventId", filter.eventId);
  if (filter.mailed) params.append("mailed", filter.mailed);
  if (filter.page) params.append("page", filter.page.toString());
  if (filter.limit) params.append("limit", filter.limit.toString());
  
  const response = await fetchApi<ListOrdersResponse>(`/api/orders?${params.toString()}`);
  return response.data || null;
}

export async function updateOrder(orderId: string, data: Partial<Order>): Promise<Order | null> {
  const response = await fetchApi<Order>(`/api/orders/${orderId}`, {
    method: "PUT",
    body: JSON.stringify(data)
  });
  return response.data || null;
}

export async function deleteOrder(orderId: string): Promise<boolean> {
  const response = await fetchApi<boolean>(`/api/orders/${orderId}`, {
    method: "DELETE"
  });
  return !!response.success;
}

// Mail
export interface SendMailResult {
  orderId: string;
  status: "sent" | "failed";
  error?: string;
}

export interface SendMailsResponse {
  sent: number;
  failed: number;
  results: SendMailResult[];
}

export async function sendMails(orderIds: string[]): Promise<SendMailsResponse | null> {
  const response = await fetchApi<SendMailsResponse>("/api/mail/send", {
    method: "POST",
    body: JSON.stringify({ orderIds }),
  });
  return response.data || null;
}
