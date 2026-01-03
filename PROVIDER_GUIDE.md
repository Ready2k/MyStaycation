# Adding a New Provider Adapter

This guide explains how to add support for a new UK staycation provider.

## Overview

Each provider requires:
1. An adapter class extending `BaseAdapter`
2. HTML parsing logic specific to the provider's website
3. Registration in the adapter registry
4. Database seed data for the provider

## Step 1: Create Adapter Class

Create a new file in `backend/src/adapters/`:

```typescript
// backend/src/adapters/centerparcs.adapter.ts
import * as cheerio from 'cheerio';
import { BaseAdapter, SearchParams, PriceResult, DealResult } from './base.adapter';

export class CenterParcsAdapter extends BaseAdapter {
  constructor() {
    super(
      process.env.CENTERPARCS_BASE_URL || 'https://www.centerparcs.co.uk',
      'centerparcs'
    );
  }

  async search(params: SearchParams): Promise<PriceResult[]> {
    const url = this.buildSearchUrl(params);
    
    // Check robots.txt
    const path = new URL(url).pathname;
    const allowed = await this.checkRobotsTxt(path);
    if (!allowed) {
      throw new Error(`Path ${path} is disallowed by robots.txt`);
    }

    try {
      // Try HTTP first
      const html = await this.fetchHtml(url);
      return this.parseSearchResults(html, params);
    } catch (error) {
      // Fallback to Playwright if needed
      console.log('HTTP fetch failed, trying Playwright...');
      const html = await this.fetchHtmlWithBrowser(url);
      return this.parseSearchResults(html, params);
    }
  }

  async fetchOffers(): Promise<DealResult[]> {
    const url = this.buildOffersUrl();
    const html = await this.fetchHtml(url);
    return this.parseOffers(html);
  }

  protected buildSearchUrl(params: SearchParams): string {
    // Build provider-specific search URL
    const queryParams = new URLSearchParams({
      adults: params.party.adults.toString(),
      children: params.party.children.toString(),
      arrival: params.dateWindow.start,
      nights: params.nights.min.toString(),
    });

    if (params.park) {
      queryParams.append('park', params.park);
    }

    return `${this.baseUrl}/search?${queryParams.toString()}`;
  }

  protected buildOffersUrl(): string {
    return `${this.baseUrl}/offers`;
  }

  protected parseSearchResults(html: string, params: SearchParams): PriceResult[] {
    const $ = cheerio.load(html);
    const results: PriceResult[] = [];

    // TODO: Update selectors based on actual website structure
    $('.result-card').each((_, element) => {
      const $el = $(element);
      
      const priceText = $el.find('.price').text().trim();
      const priceTotalGbp = this.extractPrice(priceText);
      
      const dateText = $el.find('.date').text().trim();
      const stayStartDate = this.parseDate(dateText || params.dateWindow.start);
      
      const nightsText = $el.find('.nights').text().trim();
      const stayNights = parseInt(nightsText) || params.nights.min;
      
      const pricePerNightGbp = priceTotalGbp / stayNights;
      
      const isAvailable = !$el.find('.sold-out').length;
      const availability = isAvailable ? 'AVAILABLE' : 'SOLD_OUT';
      
      results.push({
        stayStartDate,
        stayNights,
        priceTotalGbp,
        pricePerNightGbp,
        availability: availability as any,
        sourceUrl: $el.find('a').attr('href'),
      });
    });

    return results;
  }

  protected parseOffers(html: string): DealResult[] {
    const $ = cheerio.load(html);
    const deals: DealResult[] = [];

    $('.offer').each((_, element) => {
      const $el = $(element);
      
      const title = $el.find('h2').text().trim();
      const discountText = $el.find('.discount').text().trim();
      
      let discountType: DealResult['discountType'] = 'PERK';
      let discountValue: number | undefined;
      
      if (discountText.includes('%')) {
        discountType = 'PERCENT_OFF';
        discountValue = parseFloat(discountText);
      }
      
      deals.push({ title, discountType, discountValue });
    });

    return deals;
  }
}
```

## Step 2: Inspect Website Structure

Before implementing parsing logic:

1. **Visit the provider's website**
2. **Open browser DevTools** (F12)
3. **Perform a search** and inspect the HTML
4. **Identify CSS selectors** for:
   - Price elements
   - Date elements
   - Availability indicators
   - Accommodation types
   - Links to details

5. **Test selectors in console**:
   ```javascript
   document.querySelectorAll('.price')  // Should return price elements
   ```

6. **Update `parseSearchResults()` with correct selectors**

## Step 3: Register Adapter

Add to `backend/src/adapters/registry.ts`:

```typescript
import { CenterParcsAdapter } from './centerparcs.adapter';

export class AdapterRegistry {
  constructor() {
    this.registerAdapter('hoseasons', new HoseasonsAdapter());
    this.registerAdapter('haven', new HavenAdapter());
    this.registerAdapter('centerparcs', new CenterParcsAdapter());  // Add this
  }
  // ...
}
```

## Step 4: Add Database Seed

Update `backend/src/seeds/providers.seed.ts`:

```typescript
// Add Center Parcs
let centerParcs = await providerRepo.findOne({ where: { code: 'centerparcs' } });
if (!centerParcs) {
  centerParcs = providerRepo.create({
    code: 'centerparcs',
    name: 'Center Parcs',
    baseUrl: 'https://www.centerparcs.co.uk',
    enabled: true,
    checkFrequencyHours: 48,
    maxConcurrent: 2,
    notes: 'UK forest holiday villages',
  });
  await providerRepo.save(centerParcs);
}

// Add parks
const parks = [
  { code: 'sherwood-forest', name: 'Sherwood Forest', region: 'Nottinghamshire' },
  { code: 'woburn-forest', name: 'Woburn Forest', region: 'Bedfordshire' },
];

for (const parkData of parks) {
  const existing = await parkRepo.findOne({
    where: { provider: { id: centerParcs.id }, providerParkCode: parkData.code },
  });

  if (!existing) {
    const park = parkRepo.create({
      provider: centerParcs,
      providerParkCode: parkData.code,
      name: parkData.name,
      region: parkData.region,
    });
    await parkRepo.save(park);
  }
}
```

## Step 5: Add Environment Variable

Update `.env.example`:

```bash
CENTERPARCS_BASE_URL=https://www.centerparcs.co.uk
```

## Step 6: Create Integration Test

Create `backend/tests/integration/centerparcs.adapter.test.ts`:

```typescript
import { CenterParcsAdapter } from '../../src/adapters/centerparcs.adapter';
import * as fs from 'fs';
import * as path from 'path';

describe('CenterParcsAdapter', () => {
  let adapter: CenterParcsAdapter;

  beforeAll(() => {
    adapter = new CenterParcsAdapter();
  });

  afterAll(async () => {
    await adapter.cleanup();
  });

  it('should parse search results from HTML fixture', () => {
    const html = fs.readFileSync(
      path.join(__dirname, '../fixtures/centerparcs_search.html'),
      'utf-8'
    );

    const params = {
      provider: 'centerparcs',
      party: { adults: 2, children: 2 },
      dateWindow: { start: '2026-06-01', end: '2026-06-30' },
      nights: { min: 3, max: 7 },
      peakTolerance: 'mixed' as const,
    };

    const results = adapter['parseSearchResults'](html, params);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('priceTotalGbp');
    expect(results[0]).toHaveProperty('stayStartDate');
  });
});
```

## Step 7: Save HTML Fixture

1. Visit provider website and perform search
2. Save page HTML to `backend/tests/fixtures/centerparcs_search.html`
3. Use this for testing without making live requests

## Step 8: Test Adapter

```bash
# Run integration test
npm test -- centerparcs.adapter.test.ts

# Test live (use sparingly)
npm test -- centerparcs.adapter.test.ts --live
```

## Best Practices

### Respectful Scraping
- ✅ Check `robots.txt` before every request
- ✅ Use delays between requests (2+ seconds)
- ✅ Identify your bot with User-Agent
- ✅ Cache results to minimize requests
- ✅ Handle errors gracefully

### Error Handling
```typescript
try {
  const html = await this.fetchHtml(url);
  return this.parseSearchResults(html, params);
} catch (error) {
  if (error.message.includes('403') || error.message.includes('blocked')) {
    // Provider may be blocking - pause adapter
    throw new Error('Provider blocking detected');
  }
  // Try Playwright fallback
  return this.parseSearchResultsWithBrowser(url, params);
}
```

### Parsing Tips
- Use specific selectors (class names, data attributes)
- Handle missing elements gracefully
- Validate extracted data
- Log parsing errors for debugging

### Testing
- Always test with HTML fixtures first
- Only test live occasionally
- Update fixtures when website changes
- Test edge cases (sold out, no results, etc.)

## Troubleshooting

### "No results found"
- Check if selectors match current website structure
- Inspect HTML in browser DevTools
- Website may have changed - update selectors

### "Blocked by robots.txt"
- Check provider's robots.txt file
- Find alternative paths that are allowed
- Consider using official API if available

### "403 Forbidden"
- Provider may be blocking automated requests
- Try different User-Agent
- Add more delay between requests
- Consider Playwright for JavaScript rendering

## Maintenance

Providers update their websites regularly:

1. **Monitor fetch_runs table** for parse failures
2. **Update selectors** when website changes
3. **Update HTML fixtures** for tests
4. **Document changes** in adapter comments

---

For questions or issues, refer to existing adapters (Hoseasons, Haven) as examples.
