# UK Staycation Watcher – Capability Map & Final Specification

Purpose:
Provide a definitive map of watcher configuration fields, how they compare to typical UK staycation providers, and how they should be implemented internally.

Audience:
- Product & engineering
- Future contributors
- “Why does this exist?” conversations

---

## 1. High-Level Positioning

### Providers optimise for:
- Yield management
- Inventory push
- Conversion pressure

### This watcher optimises for:
- Price regret avoidance
- Cognitive load reduction
- Trust through silence

**This is not a comparison engine.  
This is a memory + judgement engine.**

---

## 2. Capability Map (Watcher vs Providers)

### 2.1 Party & Dates

| Capability | Typical Providers | Watcher | Notes |
|----------|------------------|--------|------|
| Adults / children | ✅ | ✅ | Baseline |
| Date range | ⚠️ Limited | ✅ | Core value |
| Flexible dates | ❌ | ✅ | Providers avoid exposing this |
| Min/max nights | ❌ | ✅ | Huge price impact |
| Stay pattern (midweek/weekend) | ❌ | ✅ | Hidden pricing lever |
| School holiday awareness | ❌ | ✅ | Parents assume this |

**Moat:** Providers discourage flexibility; watcher exploits it.

---

### 2.2 Budget & Value

| Capability | Providers | Watcher | Notes |
|-----------|----------|--------|------|
| Hard max budget | ❌ | ✅ | Users expect this |
| Soft budget awareness | ❌ | ✅ | Enables “nearly good” alerts |
| Value vs typical | ❌ | ✅ | Requires price memory |
| Historical context | ❌ | ✅ | Providers cannot offer this |

**Moat:** Opinionated judgement, not raw prices.

---

### 2.3 Accommodation Constraints

| Capability | Providers | Watcher | Notes |
|-----------|----------|--------|------|
| Accommodation type | ⚠️ UI only | ✅ Structured | Lodge, caravan, etc |
| Bedrooms | ⚠️ Weak | ✅ | Prevents unusable deals |
| Accommodation tier | ⚠️ Provider-specific | ✅ Normalised | Stops “cheap but grim” |
| Capacity logic | ❌ | ✅ | Humans think in beds, not SKUs |

**Moat:** Normalisation across providers.

---

### 2.4 Pets & Accessibility

| Capability | Providers | Watcher | Notes |
|-----------|----------|--------|------|
| Pets allowed | ⚠️ Binary | ✅ Structured | Emotional requirement |
| Number of pets | ❌ | ✅ | Often hidden |
| Size restrictions | ❌ | ✅ | Real-world constraint |
| Accessibility needs | ❌ | ✅ | High trust feature |

**Moat:** Treats humans like humans, not filters.

---

### 2.5 Location & Park Logic

| Capability | Providers | Watcher | Notes |
|-----------|----------|--------|------|
| Specific park selection | ✅ | ✅ | Baseline |
| Region preference | ⚠️ Weak | ✅ | Coast, forest, etc |
| Vibe filtering | ❌ | ✅ | “Wrong place” avoidance |
| Park exclusion | ❌ | ✅ | Silent deal rejection |

**Moat:** Preference memory over inventory push.

---

### 2.6 Facilities & Amenities

| Capability | Providers | Watcher | Notes |
|-----------|----------|--------|------|
| Facility filtering | ⚠️ Marketing-led | ✅ User-led | Must-have vs nice-to-have |
| Hot tub / pool | ⚠️ Clickbait | ✅ Structured | Price-driving feature |
| Accessibility facilities | ❌ | ✅ | Rare, high trust |

**Moat:** Facilities influence alerts, not ads.

---

## 3. Alerting & Intelligence (Core Differentiator)

### Providers
- “From £X”
- “Up to Y% off”
- “Hurry!”

### Watcher
- Lowest in X months
- Meaningful drop (absolute or %)
- New campaign detected
- Risk rising (availability + price)
- Silence when uncertain

| Capability | Providers | Watcher |
|----------|----------|--------|
| Price history | ❌ | ✅ |
| Alert dedupe | ❌ | ✅ |
| Risk signalling | ❌ | ✅ |
| Accountability | ❌ | ✅ |

**Moat:** Providers cannot do this without hurting revenue.

---

## 4. Final Watcher Field List (Comprehensive)

### 4.1 Core (Always Visible)
- Watcher name
- Adults
- Children
- Min nights
- Max nights
- Earliest start date
- Latest end date
- Max budget
- Pets allowed

---

### 4.2 Accommodation (High Value)
- Accommodation type (any / lodge / caravan / etc)
- Minimum bedrooms
- Accommodation tier (standard → premium)
- Capacity constraints

---

### 4.3 Dates & Flexibility (Very High Value)
- Date flexibility (fixed / ±X days / any in range)
- Stay pattern (any / midweek / weekend)
- School holiday handling (avoid / allow / only)

---

### 4.4 Location & Park
- Provider selection
- Specific parks
- Region preference (coast / forest / etc)

---

### 4.5 Pets & Accessibility
- Number of pets
- Large dogs allowed
- Step-free access
- Ground-floor only
- Accessible bathroom

---

### 4.6 Facilities
- Must-have facilities
- Nice-to-have facilities

---

### 4.7 Alert Behaviour
- Alert sensitivity (exceptional only / meaningful drops)
- Alert triggers (lowest, drop, campaign, risk)
- Alert frequency (instant / digest)

---

## 5. Internal Implementation Rules

### 5.1 Fingerprint vs Alert Logic

**Fingerprint-affecting fields**  
(change → new price history):
- Party size
- Date window
- Nights range
- Provider
- Park
- Accommodation type
- Bedrooms / capacity
- Pets allowed (binary)

**Alert-only fields**  
(do NOT invalidate history):
- Budget soft/hard
- Facilities
- Accessibility
- Alert sensitivity
- Value preferences

---

### 5.2 Series Key Scope
Series keys MUST be driven by:
- provider
- stay start date
- stay nights
- park (or ANY)
- accommodation type (or ANY)

Series keys MUST NOT include:
- price
- availability
- observation timestamp
- alert preferences

---

## 6. UX Rules (Non-Negotiable)

- All fields have defaults
- “Any” is always the default
- Advanced fields are collapsible
- Watcher summary must be human-readable:

> “2 adults, Feb 2026, 3–7 nights, pets allowed, lodge, under £1,000”

If the summary sounds wrong, the watcher is wrong.

---

## 7. Explicitly Out of Scope (For Now)

- Auto-booking
- Price prediction
- “Best day to book” guesses
- Loyalty optimisation engines
- Excessive sliders

**Reason:** These create blame without certainty.

---

## 8. Strategic Conclusion

This watcher:
- Thinks like a human
- Remembers like a machine
- Judges like a friend who hates overpaying

UK staycation providers **cannot** build this without undermining their own pricing strategy.

That asymmetry is the product.

---

## Final Statement

If a user says:
> “Just tell me when it’s actually worth booking”

…and your watcher answers that honestly,  
then everything above is doing its job.
