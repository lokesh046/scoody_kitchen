# 🏥 Telemedicine & Azure Self-Hosted Jitsi — Feature Architecture & Technical Design

## 1. Purpose

This document defines the **feature architecture, system design, and technical build specification** for the **Real-Time Video Telemedicine Consultation System** in Scooby's Kitchen powered by a **Self-Hosted Jitsi Meet cluster on Microsoft Azure**.

The development follows our established standard:

> **Backend first → API contract → Cryptographic Token Service → Azure Infrastructure → Frontend WebRTC Integration**

---

## 2. Existing System Context

The Telemedicine subsystem spans our backend, frontend, and dedicated Azure WebRTC infrastructure:

```text
scoody_kitchen/
│
├── pet-platform-backend/
│   ├── app/api/consultations.py        # Consultation booking, slot validation, room join API
│   ├── app/api/doctor.py               # Doctor availability, schedule management
│   ├── app/core/jitsi.py               # Cryptographic HS256 JWT Token Signer & Role Matrix
│   ├── app/core/config.py              # JITSI_DOMAIN, JITSI_APP_ID, JITSI_APP_SECRET
│   ├── app/models/consultation.py      # Consultation & Meeting Room DB models
│   ├── app/services/consultation_service.py # Time slot windows, availability rules
│   └── verify_jitsi_token.py           # Standalone diagnostic token test script
│
├── frontend/
│   ├── src/features/consultations/
│   │   ├── ConsultationsPage.tsx       # Booking interface, doctor selector, calendar
│   │   ├── VideoCallPage.tsx           # Full-screen WebRTC frame + live medical scribe
│   │   └── DoctorSchedulePage.tsx      # Doctor working hours & availability slots
│   └── src/api/consultations.ts        # API client for consultations & join credentials
│
└── Microsoft Azure Cloud/
    ├── Nginx Reverse Proxy             # SSL/TLS termination on ports 80 & 443
    ├── Prosody XMPP Server             # Authentication engine with mod_auth_token
    ├── Jicofo Conference Focus         # Conference session allocation & room coordinator
    ├── Jitsi Videobridge (JVB)         # Selective Forwarding Unit (SFU) on UDP 10000
    └── Coturn Server                   # STUN/TURN media relay on UDP 3478 / TCP 443
```

The system strictly preserves the layered separation:

```text
API Router (consultations.py)
    ↓
Validation Schema (consultation.py)
    ↓
Consultation Service & Jitsi Token Signer (jitsi.py)
    ↓
PostgreSQL & Azure Jitsi Prosody (HS256 JWT)
```

---

## 3. Overall Platform Architecture

```text
                         ┌─────────────────────────────────────────┐
                         │             React Frontend              │
                         │    (VideoCallPage.tsx / WebRTC UI)      │
                         └───────────────┬─────────────────────────┘
                                         │
                 ┌───────────────────────┴────────────────────────┐
                 │ 1. GET /consultations/:id/join                 │ 3. Mount Frame & Connect
                 ▼                                                ▼
     ┌───────────────────────┐                        ┌───────────────────────┐
     │    FastAPI Backend    │                        │  Azure Jitsi Instance │
     │  (JWT Token Signer)   │                        │ (meet.yourdomain.com) │
     └───────────┬───────────┘                        └───────────┬───────────┘
                 │                                                │
                 │ 2. Issues Signed HS256 Token                   │ 4. Verifies Token (Prosody)
                 │    (Role, Room, Slot Time)                     │    & Streams Media (JVB)
                 ▼                                                ▼
     ┌───────────────────────┐                        ┌───────────────────────┐
     │  PostgreSQL Database  │                        │ Real-Time WebRTC SFU  │
     │ (Appointments & Pets) │                        │ (Port 10000 UDP Media)│
     └───────────────────────┘                        └───────────────────────┘
```

---

## 4. Feature Specification: Video Telemedicine Consultation

### 4.1 Business Purpose
Enable licensed veterinarians and pet parents to conduct HD real-time video consultations directly inside the Scooby's Kitchen web platform with zero per-minute fees, full medical data privacy, and instant synchronization of pet health history and e-prescriptions.

### 4.2 Actors and Permissions

| Actor | Permissions & Role |
| :--- | :--- |
| **Veterinarian (Doctor)** | `moderator: true`<br>• Admit / kick participants<br>• Mute all / individual participants<br>• Share screen (X-rays, lab reports)<br>• Write live clinical notes & issue e-prescriptions |
| **Pet Parent (Customer)** | `moderator: false`<br>• Stream camera and microphone<br>• In-call text chat<br>• View pet profile & nutrition recommendations during call |
| **Admin** | `moderator: true`<br>• Global inspection, audit logs, doctor credential verification |

---

## 5. Standard Backend Architecture Flow

```text
                     HTTP Request (GET /consultations/{id}/join)
                                      │
                                      ▼
                             ┌─────────────────┐
                             │     Router      │
                             │ (app/api/       │
                             │  consultations) │
                             └────────┬────────┘
                                      │
                                      ▼
                             ┌─────────────────┐
                             │     Schema      │
                             │ (Consultation   │
                             │  JoinResponse)  │
                             └────────┬────────┘
                                      │
                                      ▼
                             ┌─────────────────┐
                             │    Service      │
                             │ (Validate Time  │
                             │  Window & Status│
                             └────────┬────────┘
                                      │
                                      ▼
                             ┌─────────────────┐
                             │  Jitsi Signer   │
                             │ (Sign HS256 JWT │
                             │  with Secret)   │
                             └────────┬────────┘
                                      │
                                      ▼
                             ┌─────────────────┐
                             │   PostgreSQL    │
                             │ (Consultations) │
                             └─────────────────┘
```

---

## 6. Domain Model & Database Schema

```text
┌───────────────────────────┐         ┌───────────────────────────┐
│          USERS            │         │          DOCTORS          │
├───────────────────────────┤         ├───────────────────────────┤
│ id: int (PK)              │1       *│ id: int (PK)              │
│ email: str                ├─────────┤ user_id: int (FK)         │
│ role: str                 │         │ specialization: str       │
│ full_name: str            │         │ is_verified: bool         │
└─────────────┬─────────────┘         └─────────────┬─────────────┘
              │ 1                                   │ 1
              │                                     │
              │ *                                   │ *
┌─────────────┴─────────────┐         ┌─────────────┴─────────────┐
│       CONSULTATIONS       │         │    DOCTOR_AVAILABILITY    │
├───────────────────────────┤         ├───────────────────────────┤
│ id: int (PK)              │         │ id: int (PK)              │
│ user_id: int (FK)         │         │ doctor_id: int (FK)       │
│ doctor_id: int (FK)       │         │ day_of_week: DayOfWeek    │
│ pet_id: int (FK)          │         │ start_time: Time          │
│ scheduled_at: DateTime    │         │ end_time: Time            │
│ duration_minutes: int     │         │ is_available: bool        │
│ status: ConsultationStatus│         └───────────────────────────┘
│ meeting_room_id: str      │
└─────────────┬─────────────┘
              │ 1
              │
              │ 1
┌─────────────┴─────────────┐
│       PRESCRIPTIONS       │
├───────────────────────────┤
│ id: int (PK)              │
│ consultation_id: int (FK) │
│ diagnosis: str            │
│ medications: json         │
│ pdf_url: str              │
│ issued_at: DateTime       │
└───────────────────────────┘
```

---

## 7. API Contract & Schemas

### 7.1 Join Consultation Endpoint
* **Path**: `GET /consultations/{id}/join`
* **Auth**: Required (Bearer JWT Token)
* **Access**: Consultation Customer, Assigned Doctor, or Admin

#### Response Schema (`ConsultationJoinResponse`):
```json
{
  "room_name": "scooby-consultation-104",
  "jitsi_domain": "meet.your-azure-domain.com",
  "jitsi_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "jitsi_app_id": "scooby_kitchen",
  "is_moderator": true,
  "consultation_id": 104,
  "scheduled_at": "2026-09-03T10:00:00Z",
  "duration_minutes": 30
}
```

---

## 8. Cryptographic Token Generation (`app/core/jitsi.py`)

The token signer constructs the standard Jitsi JWT claim matrix:

```text
┌─────────────────────────────────────────────────────────────┐
│                        HS256 JWT Payload                    │
├─────────────────────────────────────────────────────────────┤
│ aud: "jitsi"                                                │
│ iss: "scooby_kitchen"                                       │
│ sub: "meet.your-azure-domain.com"                           │
│ room: "*"                                                   │
│ iat: 1756857600  (Issued At)                                │
│ nbf: 1756856700  (Not Before: scheduled_at - 15 mins)       │
│ exp: 1756860300  (Expires At: scheduled_at + slot + 15 mins)│
│ context: {                                                  │
│   user: {                                                   │
│     id: "104",                                              │
│     name: "Dr. Sarah Johnson",                              │
│     email: "sarah@scoobypets.com",                          │
│     moderator: true                                         │
│   },                                                        │
│   features: {                                               │
│     recording: true,                                        │
│     livestreaming: true,                                    │
│     screen-sharing: true                                    │
│   }                                                         │
│ }                                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Azure Infrastructure & Network Port Matrix

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        Azure Network Security Group                    │
├──────────────┬──────────┬───────────────────────┬──────────────────────┤
│ Port / Proto │ Direction│ Service               │ Purpose              │
├──────────────┼──────────┼───────────────────────┼──────────────────────┤
│ 80 TCP       │ Inbound  │ HTTP                  │ SSL / Certbot ACME   │
│ 443 TCP      │ Inbound  │ HTTPS / WSS           │ Signaling & Web UI   │
│ 10000 UDP    │ Inbound  │ Jitsi Videobridge SFU │ WebRTC Media Packets │
│ 4443 TCP     │ Inbound  │ Fallback HTTPS Media  │ Strict Firewall Route│
│ 3478 UDP     │ Inbound  │ STUN / TURN           │ NAT Discovery        │
│ 22 TCP       │ Inbound  │ SSH                   │ VM Administration    │
└──────────────┴──────────┴───────────────────────┴──────────────────────┘
```

---

## 10. Frontend WebRTC Integration (`VideoCallPage.tsx`)

1. **Step 1**: Load `https://<JITSI_DOMAIN>/external_api.js` on component mount.
2. **Step 2**: Fetch credentials from `GET /consultations/{id}/join`.
3. **Step 3**: Instantiate `window.JitsiMeetExternalAPI(domain, options)` with JWT token and container ref.
4. **Step 4**: Listen to lifecycle events (`videoConferenceJoined`, `participantLeft`, `readyToClose`).
5. **Step 5**: Automatically clean up and dispose API instance on unmount to prevent memory leaks.

---

## 11. Edge Cases & Handling Strategy

```text
┌─────────────────────────────────┬──────────────────────────────────────────┐
│ Edge Case                       │ Mitigation Strategy                      │
├─────────────────────────────────┼──────────────────────────────────────────┤
│ User joins before slot starts   │ 403 Forbidden with friendly countdown UI │
│ WiFi drops mid-call             │ Jitsi ICE Restart automatically resumes  │
│ Strict corporate symmetric NAT  │ Coturn TURN relay server via TCP 443     │
│ Doctor ends consultation early  │ WebSocket event notifies patient & logs  │
│ Rogue stranger tries room link  │ Prosody rejects unauthenticated access   │
└─────────────────────────────────┴──────────────────────────────────────────┘
```

---

## 12. Environment Configuration

### Backend `.env`:
```env
JITSI_DOMAIN=meet.your-azure-domain.com
JITSI_APP_ID=scooby_kitchen
JITSI_APP_SECRET=your_configured_hs256_secret
```

### Frontend `.env`:
```env
VITE_JITSI_DOMAIN=meet.your-azure-domain.com
```
