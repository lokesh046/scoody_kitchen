# EasyPost Test Order Tracking Documentation

This document describes how to configure, run, and test the **EasyPost Test Order Tracking System** in Scooby Kitchen.

---

## 🏛️ 1. Architecture Overview

The shipping integration is decoupled from core order logic using a generic `ShippingProvider` protocol:

```text
Order Service / Admin Router
            │
            ▼
     Shipping Service
            │
            ▼
  ShippingProvider Protocol
            │
            ▼
     EasyPostProvider (Test Mode)
            │
            ▼
    EasyPost Test API / Webhooks
```

This abstraction allows replacing EasyPost in the future with India-specific providers (e.g., Delhivery, Shiprocket) without changing order business logic.

---

## ⚙️ 2. Environment Configuration

Add the following variables to your `.env` file:

```env
# EasyPost Shipping Test Configuration
EASYPOST_API_KEY=EZTK...your_easypost_test_api_key...
EASYPOST_WEBHOOK_SECRET=your_webhook_hmac_secret
EASYPOST_ENABLED=true
```

If `EASYPOST_ENABLED=false` or no API key is provided, the backend safely uses built-in EasyPost test-code simulation.

---

## 📦 3. Admin Shipment Creation

To attach a shipment and tracker to an order, an Admin makes a request to:

```http
POST /admin/orders/{order_id}/shipment
Authorization: Bearer <ADMIN_JWT_TOKEN>
Content-Type: application/json

{
  "tracking_number": "EZ2000000002",
  "carrier": "USPS"
}
```

### Response (201 Created):
```json
{
  "order_id": 1001,
  "order_status": "shipped",
  "shipment": {
    "provider": "easypost",
    "tracking_number": "EZ2000000002",
    "carrier": "USPS",
    "status": "in_transit",
    "estimated_delivery": null
  },
  "timeline": [
    {
      "status": "pending",
      "description": "Order created and stock reserved",
      "timestamp": "2026-08-16T20:00:00Z"
    },
    {
      "status": "confirmed",
      "description": "Order confirmed",
      "timestamp": "2026-08-16T20:05:00Z"
    },
    {
      "status": "shipped",
      "description": "Shipment created with carrier USPS (Tracking: EZ2000000002)",
      "timestamp": "2026-08-16T20:10:00Z"
    }
  ]
}
```

---

## 📍 4. Customer Order Tracking API

Customers can view their order status, shipment details, and timeline:

```http
GET /orders/{order_id}/tracking
Authorization: Bearer <CUSTOMER_JWT_TOKEN>
```

- **Authorization**: Customer can only view their own orders. Admin can view any order.
- **Missing Shipment**: If no shipment exists yet, returns `shipment: null` and the order creation status history.

---

## 🪝 5. EasyPost Webhooks & Localhost Testing

EasyPost sends tracking updates to:

```http
POST /webhooks/easypost
X-EasyPost-Signature: hmac-sha256=...
```

### Localhost Webhook Testing with Ngrok:
1. Expose your local FastAPI backend:
   ```bash
   ngrok http 8000
   ```
2. In EasyPost Dashboard -> Webhooks -> Add Endpoint:
   `https://your-ngrok-subdomain.ngrok-free.app/webhooks/easypost`
3. Copy the Webhook Secret into `.env`:
   `EASYPOST_WEBHOOK_SECRET=your_secret_from_easypost`

---

## 🧪 6. Available EasyPost Test Tracking Codes

Use these official EasyPost test tracking numbers when testing:

| Test Tracking Code | EasyPost Status | Scooby Shipment Status | Scooby Order Status |
| :--- | :--- | :--- | :--- |
| `EZ1000000001` | `pre_transit` | `pre_transit` | `shipped` |
| `EZ2000000002` | `in_transit` | `in_transit` | `in_transit` |
| `EZ3000000003` | `out_for_delivery` | `out_for_delivery` | `out_for_delivery` |
| `EZ4000000004` | `delivered` | `delivered` | `delivered` |
| `EZ5000000005` | `return_to_sender` | `returned` | `returned` |
| `EZ6000000006` | `failure` | `failure` | `delivery_failed` |
| `EZ7000000007` | `unknown` | `unknown` | (No change) |

---

## 🔁 7. Webhook Idempotency & Security

- **HMAC Verification**: Signatures sent in `X-EasyPost-Signature` are validated against `EASYPOST_WEBHOOK_SECRET`.
- **Idempotency Guarantee**: Every webhook event ID (`id` field, e.g. `evt_...`) is recorded in `processed_webhook_events`.
  Sending the same event twice returns `{"status": "already_processed"}` and creates zero duplicate timeline history records.
