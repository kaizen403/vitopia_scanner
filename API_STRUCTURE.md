# PRAANA Registration API Structure (Ideal)

This document outlines the ideal structure for the Registration API to ensure robust and clear synchronization between the event platform and the entry verification system.

## 1. Overview
The API should return a list of successful registrations. Instead of relying on unstructured text parsing (like matching strings in `product_meta`), the API should provide explicit item identifiers and structured metadata.

## 2. Recommended JSON Format

```json
[
  {
    "registration_id": "54321",                // Unique ID for this registration
    "order_id": "PRAANA-ORD-9988",             // External order reference
    "user": {
      "email": "student@pimsstudent.ac.in",   // Lowercase, trimmed
      "name": "John Doe",
      "college": "PIMS",                      // Explicit college name
      "phone": "+919876543210"                // International format
    },
    "payment": {
      "status": "paid",                       // Explicit status: paid, pending, failed
      "amount": 499,                          // Numeric value
      "currency": "INR",
      "timestamp": "2026-02-22T14:30:00Z"     // ISO 8601 format
    },
    "items": [                                // Array of items (allowing multiple tickets per order)
      {
        "item_type": "ticket",                // ticket, merchandise, addon
        "event_id": 421,                      // Unique ID of the event
        "access_code": "PROSHOW_DAY3",        // Explicit mapping to system access token
        "display_name": "Day 3 Proshow",
        "quantity": 1,
        "attributes": {                       // Structured variants (replaces product_meta)
          "category": "Prime",
          "size": "XL",                       // For T-Shirts
          "slot": "15:00"                     // For Speaker sessions
        }
      }
    ],
    "receipt_id": "REC-7766",
    "invoice_url": "https://..."
  }
]
```

## 3. Key Improvements Over Current Format

### A. Structured Items
**Current**: A single `product_meta` string like `"Ticket: Day 3 Pro-Show + T-shirt XL"`
**Ideal**: An array of `items`, each with its own `access_code`. This avoids regex-heavy parsing and human error in string construction.

### B. Access Codes
**Current**: Inferred by searching keywords (`"pranav"`, `"day 3"`).
**Ideal**: Every item should have a permanent `access_code` that matches the `accessToken` in the verification database (e.g., `DAY_1`, `PROSHOW3`, `PRANAV`).

### C. Attributes Object
Instead of merging size and slot info into a name, use an `attributes` object. This makes it trivial to check `attributes.size` for T-shirt distribution or `attributes.slot` for timing validation.

### D. User Object
Nesting user details makes the payload more organized and extensible (e.g., adding phone numbers or department info later).

## 4. Sync Logic Benefits
With this structure, the sync script becomes:
1.  **Identifier Based**: Check if `registration_id` exists.
2.  **Mapping Free**: Directly use `item.access_code` provided by the API.
3.  **Atomic**: Process multiple items in a single registration correctly.
