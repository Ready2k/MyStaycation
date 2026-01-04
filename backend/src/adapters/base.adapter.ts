import { chromium, Browser } from 'playwright';
import { MatchConfidence } from '../utils/result-matcher';
import { AccommodationType } from '../entities/HolidayProfile';

export interface SearchParams {
    provider: string;
    parks?: string[]; // Multiple park IDs (e.g. ['39248', '12345'])
    party: {
        adults: number;
        children: number;
    };
    dateWindow: {
        start: string; // YYYY-MM-DD
        end: string;
    };
    nights: {
        min: number;
        max: number;
    };
    accommodation?: AccommodationType;
    peakTolerance: 'offpeak' | 'mixed' | 'peak';
    // [NEW] Fingerprint-bound fields
    pets: boolean;
    minBedrooms: number;
    region?: string;
}

export interface PriceResult {
    stayStartDate: string;
    stayNights: number;
    priceTotalGbp: number;
    pricePerNightGbp: number;
    availability: 'AVAILABLE' | 'SOLD_OUT' | 'UNKNOWN';
    accomType?: string;
    sourceUrl?: string;

    // [NEW] Real-World Mapping Fields
    matchConfidence: MatchConfidence;
    matchDetails?: string;
    bedrooms?: number;
    petsAllowed?: boolean;
    tier?: string;
    propertyName?: string;
    location?: string;
    parkId?: string; // Critical for SeriesKey generation
}

export interface DealResult {
    title: string;
    discountType: 'PERCENT_OFF' | 'FIXED_OFF' | 'SALE_PRICE' | 'PERK';
    discountValue?: number;
    voucherCode?: string;
    restrictions?: Record<string, unknown>;
    startsAt?: Date;
    endsAt?: Date;
}

export abstract class BaseAdapter {
    protected baseUrl: string;
    protected providerCode: string;
    protected requestDelay: number;
    protected maxConcurrent: number;
    protected browser?: Browser;
    protected enabled: boolean;

    constructor(baseUrl: string, providerCode: string) {
        this.baseUrl = baseUrl;
        this.providerCode = providerCode;
        this.requestDelay = parseInt(process.env.PROVIDER_REQUEST_DELAY_MS || '2000');
        this.maxConcurrent = parseInt(process.env.PROVIDER_MAX_CONCURRENT || '2');

        // Check if scraping is enabled globally
        const scrapingEnabled = process.env.SCRAPING_ENABLED !== 'false';
        const providerEnabled = process.env[`PROVIDER_${providerCode.toUpperCase()}_ENABLED`] !== 'false';
        this.enabled = scrapingEnabled && providerEnabled;

        if (!this.enabled) {
            console.log(`⚠️  Provider ${providerCode} is disabled via environment variables`);
        }
    }

    /**
     * Check if adapter is enabled
     */
    isEnabled(): boolean {
        return this.enabled;
    }

    /**
     * Execute a search query for the given params
     */
    abstract search(params: SearchParams): Promise<PriceResult[]>;

    /**
     * Fetch deals from the provider's offers page
     */
    abstract fetchOffers(): Promise<DealResult[]>;

    /**
     * Parse HTML content to extract price results
     */
    protected abstract parseSearchResults(html: string, params: SearchParams): PriceResult[];

    /**
     * Parse HTML content to extract deals
     */
    protected abstract parseOffers(html: string): DealResult[];

    /**
     * Fetch HTML content via HTTP request
     */
    protected async fetchHtml(url: string): Promise<string> {
        await this.delay(this.requestDelay);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'UK-Staycation-Watcher-Bot/1.0 (Respectful price monitoring)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-GB,en;q=0.9',
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return response.text();
    }

    /**
     * Fetch HTML content via Playwright (for JS-rendered pages)
     */
    protected async fetchHtmlWithBrowser(url: string): Promise<string> {
        const playwrightEnabled = process.env.PLAYWRIGHT_ENABLED !== 'false';
        if (!playwrightEnabled) {
            throw new Error('Playwright is disabled via PLAYWRIGHT_ENABLED environment variable');
        }

        if (!this.browser) {
            this.browser = await chromium.launch({
                headless: true,
                executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            });
        }

        const page = await this.browser.newPage();

        try {
            // Use domcontentloaded instead of networkidle for better reliability
            // Modern sites often have background requests that prevent networkidle
            await page.goto(url, {
                waitUntil: 'domcontentloaded',
                timeout: 60000 // Increase timeout to 60 seconds
            });

            // Wait a bit for dynamic content to load
            await this.delay(3000);

            const html = await page.content();
            return html;
        } finally {
            await page.close();
        }
    }

    /**
     * Close browser instance
     */
    async cleanup(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = undefined;
        }
    }

    /**
     * Delay execution
     */
    protected delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Build search URL for the provider
     */
    protected abstract buildSearchUrl(params: SearchParams): string;

    /**
     * Build offers page URL
     */
    protected abstract buildOffersUrl(): string;

    /**
     * Check robots.txt compliance - returns true if allowed, false if disallowed
     */
    async checkRobotsTxt(path: string): Promise<boolean> {
        try {
            const robotsUrl = `${this.baseUrl}/robots.txt`;
            const response = await fetch(robotsUrl);
            const robotsTxt = await response.text();

            // Simple check - in production, use a proper robots.txt parser
            const disallowedPaths = robotsTxt
                .split('\n')
                .filter(line => line.trim().startsWith('Disallow:'))
                .map(line => line.split(':')[1].trim());

            const isDisallowed = disallowedPaths.some(disallowed =>
                disallowed && path.startsWith(disallowed)
            );

            return !isDisallowed;
        } catch (error) {
            console.warn(`Could not fetch robots.txt for ${this.baseUrl}:`, error);
            return true; // Proceed with caution if robots.txt unavailable
        }
    }

    /**
     * Extract price from string (handles various formats)
     */
    protected extractPrice(priceStr: string): number | null {
        if (!priceStr) return null;

        const cleaned = priceStr.replace(/[£,\s]/g, '');
        const price = parseFloat(cleaned);

        return isNaN(price) ? null : price;
    }

    /**
     * Parse date string to YYYY-MM-DD format
     * Returns null if date cannot be confidently parsed
     */
    protected parseDate(dateStr: string): string | null {
        if (!dateStr) return null;

        try {
            const date = new Date(dateStr);
            if (isNaN(date.getTime())) {
                return null;
            }
            return date.toISOString().split('T')[0];
        } catch {
            return null;
        }
    }

    /**
     * Parse nights/duration from string
     * Returns null if cannot be confidently parsed
     */
    protected parseNights(nightsStr: string): number | null {
        if (!nightsStr) return null;

        // Try to extract number from strings like "3 nights", "7-night stay"
        const match = nightsStr.match(/(\d+)\s*night/i);
        if (match) {
            const nights = parseInt(match[1]);
            return isNaN(nights) || nights <= 0 ? null : nights;
        }

        // Try direct number parsing
        const nights = parseInt(nightsStr);
        return isNaN(nights) || nights <= 0 ? null : nights;
    }

    /**
     * Calculate price per night safely
     */
    protected calculatePricePerNight(totalPrice: number, nights: number): number | null {
        if (!nights || nights <= 0 || !totalPrice) {
            return null;
        }

        const perNight = totalPrice / nights;
        return isNaN(perNight) ? null : perNight;
    }

    /**
     * Normalize URL (handle relative vs absolute)
     */
    protected normalizeUrl(url: string | undefined): string | undefined {
        if (!url) return undefined;

        try {
            // If already absolute, return as-is
            if (url.startsWith('http://') || url.startsWith('https://')) {
                return url;
            }

            // Handle relative URLs
            const baseUrl = this.baseUrl.endsWith('/') ? this.baseUrl.slice(0, -1) : this.baseUrl;
            const path = url.startsWith('/') ? url : `/${url}`;

            return `${baseUrl}${path}`;
        } catch {
            return undefined;
        }
    }
}
