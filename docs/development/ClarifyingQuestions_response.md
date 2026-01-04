# Clarifying Questions & MVP Defaults
UK Staycation Price & Deal Watcher

This document captures implementation decisions needed to start building the MVP.
Where answers are not yet confirmed, a recommended MVP default is provided.

---

## 1. Provider Selection

### Questions
- Which UK staycation providers should we start with for the MVP?
- Do you have a preference for which 1–2 providers to implement first?

### MVP Default (Recommended)
- Start with **Hoseasons** and **Haven**
- Add **Center Parcs** as provider #3 once the pipeline is stable

**Reasoning:** validate pricing movement + promotions + inventory variety before tackling harder providers.

---

## 2. Data Collection Approach

### Questions
- Do any target providers have public APIs, or will this primarily rely on web extraction?
- Are you comfortable using headless browser automation (Playwright/Puppeteer), or prefer simpler HTTP requests?

### MVP Default (Recommended)
- Assume **no public APIs**; use **web extraction**
- Use **HTTP requests + HTML parsing first**
- Use **Playwright** only when required (JS-rendered pages, bot challenges, complex flows)

**Rule:** Headless is a fallback, not the baseline.

---

## 3. Database & Storage

### Questions
- Preferred database? (PostgreSQL, MySQL, SQLite, MongoDB, etc.)
- Any hosting constraints or preferred runtime environment?

### MVP Default (Recommended)
- **PostgreSQL** as primary database (time series observations + JSONB)
- Optional: object storage for HTML snapshots (S3-compatible)
- Local dev: Docker Compose
- Deployment target: AWS (Lightsail, ECS Fargate, or similar)

---

## 4. Mobile Access

### Questions
- Does “mobile access” mean responsive web UI or native app?
- The requirements say “web is sufficient”. Is that still the preference?

### MVP Default (Recommended)
- **Responsive web interface** (mobile browser-friendly)
- No native app for MVP

---

## 5. Authentication

### Questions
- Is email/password sufficient for MVP, or should OAuth (Google, etc.) be used?
- Is email verification required?

### MVP Default (Recommended)
- Email/password authentication
- **Email verification enabled**
- Optional later: OAuth providers

---

## 6. Email Notifications

### Questions
- Preferred email delivery provider? (SendGrid, AWS SES, Mailgun, SMTP, etc.)
- Should the MVP use a configurable SMTP setup?

### MVP Default (Recommended)
- **AWS SES** for outbound notifications
- Support later swapping via an interface (provider-agnostic notification service)

---

## 7. Deployment & Security

### Questions
- What Docker hosting environment will be used? (local, VPS, AWS, etc.)
- Should the MVP include:
  - HTTPS/SSL setup instructions?
  - Rate limiting?
  - CAPTCHA for registration?
  - Environment-variable management?

### MVP Default (Recommended)
- Docker everywhere (dev + prod)
- Include:
  - **HTTPS/SSL** (via reverse proxy or managed TLS)
  - **Rate limiting** on auth + public endpoints
  - **Environment variables** for secrets + config
  - **Audit logging** for fetch runs and alert decisions
- CAPTCHA: not required initially; add if abuse occurs

---

## 8. Testing Scope

### Questions
- Desired testing level:
  - Unit tests for core logic?
  - Integration tests for scrapers/adapters?
  - End-to-end tests?
  - Manual checklist?

### MVP Default (Recommended)
- Unit tests:
  - fingerprint canonicalisation
  - insight thresholds (lowest-in-window, meaningful drop, dedupe rules)
- Integration tests:
  - one per provider adapter, using stored HTML fixtures
- Minimal manual checklist for release validation
- E2E tests deferred unless UI complexity grows

---

## Decision Log

| Area | MVP Decision | Notes |
|------|--------------|------|
| Providers | Hoseasons + Haven | Center Parcs later |
| Extraction | HTTP-first, Playwright fallback | keep it light |
| DB | PostgreSQL | JSONB + history queries |
| Mobile | Responsive web | no native app |
| Auth | Email/password + verification | OAuth later |
| Email | AWS SES | interface for portability |
| Security | HTTPS + rate limiting + env vars | CAPTCHA later |
| Testing | Unit + adapter integration | E2E later |

