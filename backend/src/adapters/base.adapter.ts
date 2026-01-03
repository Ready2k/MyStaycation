import { chromium, Browser } from 'playwright';

export interface SearchParams {
    provider: string;
    park?: string;
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
    accommodation?: string;
    peakTolerance: 'offpeak' | 'mixed' | 'peak';
}

export interface PriceResult {
    stayStartDate: string;
    stayNights: number;
    priceTotalGbp: number;
    pricePerNightGbp: number;
    availability: 'AVAILABLE' | 'SOLD_OUT' | 'UNKNOWN';
    accomType?: string;
    sourceUrl?: string;
}

export interface DealResult {
    title: string;
    discountType: 'PERCENT_OFF' | 'FIXED_OFF' | 'SALE_PRICE' | 'PERK';
    discountValue?: number;
    voucherCode?: string;
    restrictions?: Record<string, any>;
    startsAt?: Date;
    endsAt?: Date;
}

export abstract class BaseAdapter {
    protected baseUrl: string;
    protected providerCode: string;
    protected requestDelay: number;
    protected maxConcurrent: number;
    protected browser?: Browser;

    constructor(baseUrl: string, providerCode: string) {
        this.baseUrl = baseUrl;
        this.providerCode = providerCode;
        this.requestDelay = parseInt(process.env.PROVIDER_REQUEST_DELAY_MS || '2000');
        this.maxConcurrent = parseInt(process.env.PROVIDER_MAX_CONCURRENT || '2');
    }

    /**
     * Execute a search query for the given parameters
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
        if (!this.browser) {
            this.browser = await chromium.launch({
                headless: true,
                args: ['--no-sandbox', '--disable-setuid-sandbox'],
            });
        }

        const page = await this.browser.newPage();

        try {
            await page.goto(url, { waitUntil: 'networkidle' });
            await this.delay(this.requestDelay);

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
     * Check robots.txt compliance
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

            return !disallowedPaths.some(disallowed => path.startsWith(disallowed));
        } catch (error) {
            console.warn(`Could not fetch robots.txt for ${this.baseUrl}:`, error);
            return true; // Proceed with caution if robots.txt unavailable
        }
    }

    /**
     * Extract price from string (handles various formats)
     */
    protected extractPrice(priceStr: string): number {
        const cleaned = priceStr.replace(/[£,\s]/g, '');
        return parseFloat(cleaned);
    }

    /**
     * Parse date string to YYYY-MM-DD format
     */
    protected parseDate(dateStr: string): string {
        const date = new Date(dateStr);
        return date.toISOString().split('T')[0];
    }
}
