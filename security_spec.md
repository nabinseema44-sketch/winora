# WINORA Security Specification — Firestore User Database (STEP 4)

## 1. Core Data Invariants & Access Control Policy

1. **Self-Access Only (Strict Single-Tenant Isolation)**:
   - An authenticated player can only `get` their own document at `/users/{uid}` where `request.auth.uid == uid`.
   - Blanket listing or querying other players' user documents (`allow list: if false`) is completely forbidden.
   - Unauthenticated callers (`request.auth == null`) receive `PERMISSION_DENIED` on all read and write attempts.

2. **Immutable Identity & Authorization Fields**:
   - `uid`: Technical identifier, strictly immutable after creation (`request.resource.data.uid == resource.data.uid`).
   - `role`: Hardcoded to `'player'` upon creation. A player cannot change their own role or promote themselves to `admin` or any other privilege.
   - `status`: Hardcoded to `'active'` upon creation. Players cannot modify their own account status.
   - `createdAt`: Set once at creation time, strictly immutable thereafter.
   - `phoneNumber`: Verified mobile identity set during phone verification; cannot be arbitrarily altered during profile editing.

3. **Safe Profile Updates Only**:
   - Logged-in players are strictly limited to editing safe display fields: `displayName` (and optional `avatar`).
   - `displayName` must be a valid string of length 2 to 50 characters.
   - `updatedAt` must be updated on every modification.
   - The diff of affected keys must only include `['displayName', 'updatedAt', 'avatar']`.

4. **Zero Secrets in Database**:
   - Fields such as `password`, `otp`, `code`, `salt`, `hash`, `token`, `isAdmin` are strictly rejected by Security Rules if present in any write payload.

---

## 2. The "Dirty Dozen" Malicious Payloads (All Must Yield PERMISSION_DENIED)

| # | Attack Vector / Scenario | Target Path & Operation | Malicious Payload / Context | Expected Result |
|---|--------------------------|-------------------------|------------------------------|-----------------|
| 1 | **Unauthenticated Read** | `GET /users/user_123` | `request.auth = null` | `PERMISSION_DENIED` |
| 2 | **Cross-User Profile Read** | `GET /users/victim_456` | `request.auth.uid = "attacker_123"` | `PERMISSION_DENIED` |
| 3 | **Unauthenticated Profile Creation** | `CREATE /users/anon_1` | `request.auth = null` | `PERMISSION_DENIED` |
| 4 | **Identity Spoofing Creation** | `CREATE /users/victim_456` | `request.auth.uid = "attacker_123"`, data: `{ uid: "victim_456" }` | `PERMISSION_DENIED` |
| 5 | **Self-Privilege Escalation** | `UPDATE /users/user_123` | `request.auth.uid = "user_123"`, data: `{ role: "admin" }` | `PERMISSION_DENIED` |
| 6 | **Status Tampering** | `UPDATE /users/user_123` | `request.auth.uid = "user_123"`, data: `{ status: "vip_unlocked" }` | `PERMISSION_DENIED` |
| 7 | **UID Overwrite / Hijack** | `UPDATE /users/user_123` | `request.auth.uid = "user_123"`, data: `{ uid: "new_id_999" }` | `PERMISSION_DENIED` |
| 8 | **Secret / Credential Injection** | `CREATE /users/user_123` | `{ ..., password: "supersecretpassword", otp: "123456" }` | `PERMISSION_DENIED` |
| 9 | **Retroactive Creation Date Spoofing** | `UPDATE /users/user_123` | `{ createdAt: "2020-01-01T00:00:00.000Z" }` | `PERMISSION_DENIED` |
| 10| **Oversized / Malicious Name Injection** | `UPDATE /users/user_123` | `{ displayName: "A".repeat(500) }` | `PERMISSION_DENIED` |
| 11| **Empty / Truncated Display Name** | `UPDATE /users/user_123` | `{ displayName: " " }` (length < 2) | `PERMISSION_DENIED` |
| 12| **Unauthorized Collection Access (Wallets/Games)** | `WRITE /wallets/user_123` | `{ virtualCredits: 999999 }` | `PERMISSION_DENIED` |

---

## 3. Security Rules Verification Strategy

- **Unit Testing**: Run with `@firebase/rules-unit-testing` or the Firebase Local Emulator Suite.
- **Rule Syntax Verification**: Evaluated with Firebase security rules validator.
- **Client Service Layer**: The client API `updateUserProfile()` is engineered to pass only safe keys, with strict server-side validation rejecting any attempt to tamper with role, status, or UID.
