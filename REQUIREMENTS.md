# UK Staycation Price & Deal Watcher  
## MVP Requirements Specification

---

## 1. Purpose

Build a personal assistant that monitors UK staycation prices and deals over time and alerts users only when booking conditions are meaningfully good.

The system is **not**:
- A comparison site
- A booking engine
- An auto-booking bot

The system **is**:
- A watcher
- A memory
- A filter
- An alerting engine

---

## 2. Scope (MVP)

### In Scope
- Price monitoring for selected UK staycation providers
- Deal and promotion detection
- Historical price memory
- Opinionated, low-noise alerts
- Manual booking by the user

### Out of Scope
- Auto-booking or payment handling
- Affiliate redirection (initially)
- Price prediction guarantees
- Regulated advice or claims
- Aggressive scraping or API abuse

---

## 3. User Requirements

### 3.1 User Accounts
- Users MUST be able to:
  - Create an account
  - Log in securely
  - Manage notification preferences
- Authentication MAY initially be email-based only

---

### 3.2 Holiday Profiles (Canonical Search Fingerprint)

Users MUST be able to define one or more holiday profiles.

Each profile MUST include:
- Preferred provider(s)
- Location(s) or park(s)
- Party size (adults, children)
- Date constraints:
  - Fixed dates OR
  - Flexible date range
- Stay duration (min/max nights)
- Peak vs off-peak tolerance

Each profile MUST:
- Be stored as a canonical, reusable fingerprint
- Not require repeated manual reconfiguration
- Be editable and pausable

---

## 4. Provider Monitoring Requirements

### 4.1 Provider Coverage (MVP)
- Initial MVP MUST support a limited set of providers (1–2 minimum)
- Each provider MUST be implemented via a dedicated adapter/module

---

### 4.2 Monitoring Behaviour
- The system MUST:
  - Check prices at low frequency (24–72 hours)
  - Apply randomised jitter to request timing
  - Use clean, non-logged sessions
- The system MUST NOT:
  - Poll continuously
  - Influence pricing behaviour
  - Exceed conservative request thresholds

---

### 4.3 Search Execution
- Each monitoring run MUST:
  - Execute a deterministic search based on the stored fingerprint
  - Capture all returned prices relevant to the fingerprint
  - Record availability where possible

---

## 5. Price Observation & Memory

### 5.1 Price Capture
For each monitoring run, the system MUST store:
- Provider
- Location / park
- Accommodation type
- Stay start date
- Number of nights
- Total price (GBP)
- Availability status
- Observation timestamp

---

### 5.2 Historical Context
The system MUST maintain:
- Historical price observations
- Minimum observed price per fingerprint
- Rolling baseline (e.g. 90–180 day window)
- Simple volatility indicators

---

## 6. Deal & Promotion Detection

### 6.1 Deal Sources
The system MUST monitor:
- Official provider “Offers” or “Deals” pages
- Community deal sources (e.g. moderated deal platforms)

---

### 6.2 Deal Normalisation
Each detected deal MUST be stored with:
- Provider (if applicable)
- Deal source
- Discount type (percentage, fixed amount, sale pricing)
- Voucher code (if present)
- Eligibility constraints (e.g. NHS, Blue Light)
- Known restrictions (dates, min spend)
- Detection timestamp

---

## 7. Insight Generation

### 7.1 Insight Types (MVP)
The system MUST support generation of insights such as:
- Lowest price seen in X days/months
- Meaningful price drop since last observation
- New provider-wide promotion detected
- Voucher code relevant to monitored provider
- Rising booking risk (availability shrinking + prices rising)

---

### 7.2 Insight Quality
Insights MUST:
- Be evidence-backed
- Reference historical context
- Avoid “up to” or vague language
- Be generated only when thresholds are met

---

## 8. Alerts & Notifications

### 8.1 Alert Triggers
Alerts MUST be sent only when:
- A meaningful insight is generated
- The insight is relevant to the user’s profile
- The alert is not a duplicate of a recent notification

---

### 8.2 Alert Channels (MVP)
- Email MUST be supported
- Push/SMS MAY be added later

---

### 8.3 Noise Control
The system MUST:
- Deduplicate alerts
- Limit repeat alerts per profile and insight type
- Support digest-style notifications

---

## 9. Auditability & Safety

### 9.1 Fetch Logging
Each monitoring run MUST record:
- Provider
- Run type (search, offers page, deal source)
- Timestamp
- Result status (success, blocked, failed)
- HTTP status (if applicable)

---

### 9.2 Compliance Constraints
The system MUST:
- Avoid aggressive scraping
- Avoid login-required content
- Avoid resale of proprietary pricing data
- Respect provider rate limits and access patterns

---

## 10. Non-Functional Requirements

### 10.1 Performance
- Monitoring jobs are non-real-time
- UI response times SHOULD be <500ms for typical queries

---

### 10.2 Reliability
- Temporary provider failures MUST NOT crash the system
- Provider adapters MUST be independently disableable

---

### 10.3 Extensibility
- New providers MUST be addable without schema redesign
- New insight types MUST be addable without reprocessing all history

---

## 11. Explicit Non-Requirements

The MVP explicitly does NOT require:
- Auto-booking
- Payment processing
- Affiliate integration
- Mobile app (web is sufficient)
- Machine-learning-based price prediction

---

## 12. Success Criteria (MVP Validation)

The MVP is considered successful if:
- A user receives at least one alert that changes when they book
- The system demonstrably prevents overpaying or excessive checking
- Provider monitoring remains stable over time without blocks
