# PRAANA Fest Management API Documentation

This documentation covers the internal API endpoints for managing Events, Workshops, Slots, and Registrations.

## Base URL
`http://localhost:3001/api` (Development)

## Authentication

The system uses JWT-based authentication via HTTP-only cookies.

1.  **Login**: `POST /auth/login`
    *   **Body**: `{ "username": "...", "password": "..." }`
    *   **Success**: Returns JSON with `role` (admin/scanner). Sets a cookie named `opus-session`.
2.  **Logout**: `POST /auth/logout`

---

## 1. Events & Workshops

### Create Event/Workshop
`POST /events`
*   **Permissions**: Admin only.
*   **Body Parameter**:
    *   `name` (string, required)
    *   `description` (string, required)
    *   `date` (number/timestamp, required)
    *   `venue` (string, required)
    *   `capacity` (number, required)
    *   `price` (number, required)
    *   `type` (string: `"EVENT"` or `"WORKSHOP"`. Default: `"EVENT"`)
    *   `slots` (array, optional - required for Workshops)
        *   `startTime` (number/timestamp)
        *   `endTime` (number/timestamp)
        *   `capacity` (number)
*   **Example Body (Workshop)**:
    ```json
    {
      "name": "Design Thinking Workshop",
      "type": "WORKSHOP",
      "date": 1771734600000,
      "venue": "Hall B",
      "capacity": 100,
      "price": 150,
      "slots": [
        { "startTime": 1771734600000, "endTime": 1771741800000, "capacity": 50 },
        { "startTime": 1771745400000, "endTime": 1771752600000, "capacity": 50 }
      ]
    }
    ```

### List Active Items
`GET /events`
*   **Query**: `?type=WORKSHOP` or `?type=EVENT` (optional)
*   **Returns**: List of active events/workshops including their slots.

### Get Workshop Details & Stats
`GET /events/:id/stats`
*   **Returns**: Detailed information about an event including total tickets sold, revenue, and a breakdown of registrations per slot.

---

## 2. Orders & Registrations

### Create Registration
`POST /orders`
*   **Body Parameter**:
    *   `userId` (string, required)
    *   `eventId` (string, required)
    *   `slotId` (string, optional - recommended for workshops)
    *   `quantity` (number, required)
*   **Example Body**:
    ```json
    {
      "userId": "user-uuid",
      "eventId": "workshop-uuid",
      "slotId": "slot-uuid",
      "quantity": 1
    }
    ```

### Get Order Details
`GET /orders/:orderId`
*   **Returns**: Order status, user details, event/slot details, and a `qrCode` string if paid.

### Mark as Paid (Simulated)
`POST /orders/:orderId/pay`
*   **Function**: Transitions order status from `pending` to `paid`. In a production scenario, this would be called by a payment gateway webhook.

---

## 3. Entry & Scanning

### Verify Entry
`POST /scan/verify`
*   **Permissions**: Scanner role (Session Cookie)
*   **Body**: `{ "qrCode": "...", "eventId": "..." }`
*   **Logic**: 
    1. Validates QR token.
    2. Checks if order is paid.
    3. Checks if ticket belongs to the requested event.
    4. Performs atomic check-in (prevents double entry via Redis lock).

### Get QR Image
`GET /orders/:orderId/qr-image`
*   **Returns**: A styled PNG image of the PRAANA entry pass.

---

## Constants & Enums

### Event Types
*   `EVENT`: Standard fixed-time event.
*   `WORKSHOP`: Flexible event with multiple scheduled slots.

### Payment Status
*   `pending`: Order created, awaiting payment.
*   `paid`: Payment confirmed, QR code active.
*   `failed`: Transaction failed.
*   `refunded`: Order canceled.
