import { BaseAdapter } from './base.adapter';
import { HoseasonsAdapter } from './hoseasons.adapter';
import { HavenAdapter } from './haven.adapter';
import { CenterParcsAdapter } from './centerparcs.adapter';
import { ParkdeanAdapter } from './parkdean.adapter';
import { ButlinsAdapter } from './butlins.adapter';
import { AwayResortsAdapter } from './awayresorts.adapter';

/**
 * Returns true when the env var is absent (default on) or explicitly "true".
 * Set PROVIDER_<NAME>_ENABLED=false to disable a provider at runtime.
 */
function providerEnabled(envKey: string): boolean {
    const val = process.env[envKey];
    return val === undefined || val.toLowerCase() === 'true';
}

const PROVIDERS = [
    {
        code: 'hoseasons',
        name: 'Hoseasons',
        envKey: 'PROVIDER_HOSEASONS_ENABLED',
        factory: () => new HoseasonsAdapter(),
    },
    {
        code: 'haven',
        name: 'Haven',
        envKey: 'PROVIDER_HAVEN_ENABLED',
        factory: () => new HavenAdapter(),
    },
    {
        code: 'centerparcs',
        name: 'Center Parcs',
        envKey: 'PROVIDER_CENTERPARCS_ENABLED',
        factory: () => new CenterParcsAdapter(),
    },
    {
        code: 'parkdean',
        name: 'Parkdean Resorts',
        envKey: 'PROVIDER_PARKDEAN_ENABLED',
        factory: () => new ParkdeanAdapter(),
    },
    {
        code: 'butlins',
        name: "Butlin's",
        envKey: 'PROVIDER_BUTLINS_ENABLED',
        factory: () => new ButlinsAdapter(),
    },
    {
        code: 'awayresorts',
        name: 'Away Resorts',
        envKey: 'PROVIDER_AWAYRESORTS_ENABLED',
        factory: () => new AwayResortsAdapter(),
    },
] as const;

export class AdapterRegistry {
    private adapters: Map<string, BaseAdapter> = new Map();
    private metadata: Array<{ code: string; name: string; enabled: boolean }> = [];

    constructor() {
        for (const provider of PROVIDERS) {
            const enabled = providerEnabled(provider.envKey);
            this.metadata.push({ code: provider.code, name: provider.name, enabled });

            if (!enabled) {
                console.log(`⏭️  Provider disabled by env: ${provider.code} (${provider.envKey}=false)`);
                continue;
            }

            const adapter = provider.factory();
            // Register both lower and upper-case variants for lookup robustness
            this.adapters.set(provider.code.toLowerCase(), adapter);
            this.adapters.set(provider.code.toUpperCase(), adapter);
        }
    }

    registerAdapter(providerCode: string, adapter: BaseAdapter): void {
        this.adapters.set(providerCode, adapter);
    }

    getAdapter(providerCode: string): BaseAdapter {
        const adapter = this.adapters.get(providerCode);
        if (!adapter) {
            const meta = this.metadata.find(m => m.code === providerCode.toLowerCase());
            if (meta && !meta.enabled) {
                throw new Error(`Provider '${providerCode}' is disabled (set ${PROVIDERS.find(p => p.code === meta.code)?.envKey}=true to enable)`);
            }
            throw new Error(`No adapter found for provider: ${providerCode}`);
        }
        return adapter;
    }

    getAllAdapters(): Map<string, BaseAdapter> {
        return this.adapters;
    }

    getProviderMetadata(): Array<{ code: string; name: string; enabled: boolean }> {
        return this.metadata;
    }

    async cleanupAll(): Promise<void> {
        const seen = new Set<BaseAdapter>();
        for (const adapter of this.adapters.values()) {
            if (!seen.has(adapter)) {
                seen.add(adapter);
                await adapter.cleanup();
            }
        }
    }
}

export const adapterRegistry = new AdapterRegistry();
