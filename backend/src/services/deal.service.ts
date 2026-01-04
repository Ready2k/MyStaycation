import { AppDataSource } from '../config/database';
import { Deal, DealSource } from '../entities/Deal';
import { Provider } from '../entities/Provider';
import { adapterRegistry } from '../adapters/registry';
import * as crypto from 'crypto';

export class DealService {
    private dealRepo = AppDataSource.getRepository(Deal);
    private providerRepo = AppDataSource.getRepository(Provider);

    /**
     * Scan all enabled providers for deals
     */
    async scanAllProviders(): Promise<void> {
        console.log('🛍️ Starting global deal scan...');
        const providers = await this.providerRepo.find({ where: { enabled: true } });

        for (const provider of providers) {
            await this.scanProvider(provider);
        }
        console.log('✅ Global deal scan completed.');
    }

    /**
     * Scan a specific provider for deals
     */
    async scanProvider(provider: Provider): Promise<void> {
        console.log(`🛍️ Scanning deals for ${provider.name}...`);

        try {
            const adapter = adapterRegistry.getAdapter(provider.code);
            if (!adapter.isEnabled()) {
                console.log(`   Skipping ${provider.code} (adapter disabled)`);
                return;
            }

            const deals = await adapter.fetchOffers();
            console.log(`   Found ${deals.length} offers from ${provider.code}`);

            if (deals.length === 0) return;

            let savedCount = 0;
            for (const offer of deals) {
                // Generate a unique reference hash or string for deduplication
                // Using URL or Title + Discount as ref
                const sourceRef = crypto.createHash('sha256')
                    .update(`${offer.title}|${offer.discountType}|${offer.discountValue}`)
                    .digest('hex');

                // Check if exists
                let deal = await this.dealRepo.findOne({
                    where: {
                        provider: { id: provider.id },
                        source: DealSource.PROVIDER_OFFERS,
                        sourceRef
                    }
                });

                if (deal) {
                    // Update last seen
                    deal.lastSeenAt = new Date();
                    // Update meta if changed
                    deal.endsAt = offer.endsAt;
                    await this.dealRepo.save(deal);
                } else {
                    // Create new
                    deal = this.dealRepo.create({
                        provider: provider,
                        source: DealSource.PROVIDER_OFFERS,
                        sourceRef,
                        title: offer.title,
                        discountType: offer.discountType as any, // Cast to avoid TS enum mismatch depending on strictness
                        discountValue: offer.discountValue,
                        voucherCode: offer.voucherCode,
                        restrictions: offer.restrictions,
                        startsAt: offer.startsAt,
                        endsAt: offer.endsAt,
                        detectedAt: new Date(),
                        lastSeenAt: new Date(),
                        confidence: 0.8 // High confidence for official site
                    });
                    await this.dealRepo.save(deal);
                    savedCount++;
                }
            }
            console.log(`   Saved ${savedCount} new deals for ${provider.code}`);

        } catch (error) {
            console.error(`❌ Failed to scan deals for ${provider.code}:`, error);
        }
    }
}

export const dealService = new DealService();
