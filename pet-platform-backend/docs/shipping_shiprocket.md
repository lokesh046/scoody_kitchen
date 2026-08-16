# Shiprocket Order Tracking Documentation

This document describes how to configure, run, and test the **Shiprocket Order Tracking System** in Scooby Kitchen.

---

## 🏛️ 1. Architecture & Provider Factory

Shiprocket is natively integrated using the `ShippingProvider` protocol abstraction. You can switch between **EasyPost** and **Shiprocket** dynamically via `.env`:

```text
Order Service / Admin Router
            │
            ▼
     Shipping Service
            │
            ▼
 get_shipping_provider() Factory
       ┌────┴────┐
       ▼         ▼
  Shiprocket   EasyPost
  Provider     Provider
```

---

## ⚙️ 2. Environment Configuration

Add the following variables to your `.env` file to enable Shiprocket in production:

```env
# Shipping Provider Switch ("shiprocket" or "easypost")
SHIPPING_PROVIDER=shiprocket

# Shiprocket Account Configuration
SHIPROCKET_EMAIL=admin@scoobykitchen.com
SHIPROCKET_PASSWORD=your_shiprocket_password
SHIPROCKET_ENABLED=true
SHIPROCKET_WEBHOOK_TOKEN=your_custom_webhook_secret_token
```

If `SHIPROCKET_ENABLED=false` or no credentials are provided, the system automatically uses built-in Shiprocket AWB test simulation.

---

## 📦 3. Admin Shipment Registration

To register a Shiprocket shipment & AWB tracking code:

```http
POST /admin/orders/{order_id}/shipment
Authorization: Bearer <ADMIN_JWT_TOKEN>
Content-Type: application/json

{
  "tracking_number": "SR2000000002",
  "carrier": "Shiprocket"
}
```

### Response (201 Created):
```json
{
  "order_id": 1002,
  "order_status": "in_transit",
  "shipment": {
    "provider": "shiprocket",
    "tracking_number": "SR2000000002",
    "carrier": "Shiprocket",
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
      "status": "in_transit",
      "description": "Shipment created via Shiprocket with carrier Shiprocket (Tracking: SR2000000002)",
      "timestamp": "2026-08-16T20:10:00Z"
    }
  ]
}
```

---

## 📍 4. Customer Tracking Endpoint

Customers query order status and tracking timeline:

```http
GET /orders/{order_id}/tracking
Authorization: Bearer <CUSTOMER_JWT_TOKEN>
```

---

## 🪝 5. Shiprocket Webhook Configuration

Shiprocket sends live AWB status webhooks to:

```http
POST /webhooks/shiprocket
x-shiprocket-token: your_custom_webhook_secret_token
Content-Type: application/json

{
  "awb": "SR2000000002",
  "current_status": "IN TRANSIT",
  "current_timestamp": "2026-08-16 20:30:00"
}
```

### Setting up Webhooks in Shiprocket Dashboard:
1. Go to Shiprocket Dashboard -> Settings -> API -> Webhooks.
2. Add Webhook URL: `https://your-domain.com/webhooks/shiprocket`
3. Add Custom Header: `x-shiprocket-token: your_custom_webhook_secret_token`
4. Enable events: **Order Status Update**, **Tracking Status Update**.

---

## 🧪 6. Test Tracking AWBs (Simulation Mode)

When `SHIPROCKET_ENABLED=false` or testing locally, use these test AWBs:

| Test AWB Code | Shiprocket Status | Scooby Shipment Status | Scooby Order Status |
| :--- | :--- | :--- | :--- |
| `SR1000000001` | `AWB ASSIGNED` | `pre_transit` | `shipped` |
| `SR2000000002` | `IN TRANSIT` | `in_transit` | `in_transit` |
| `SR3000000003` | `OUT FOR DELIVERY` | `out_for_delivery` | `out_for_delivery` |
| `SR4000000004` | `DELIVERED` | `delivered` | `delivered` |
| `SR5000000005` | `RETURNED` | `returned` | `returned` |
| `SR6000000006` | `FAILED` | `failure` | `delivery_failed` |
