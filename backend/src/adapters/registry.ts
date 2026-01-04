import { BaseAdapter } from './base.adapter';
import { HoseasonsAdapter } from './hoseasons.adapter';
import { HavenAdapter } from './haven.adapter';
import { CenterParcsAdapter } from './centerparcs.adapter';
import { ParkdeanAdapter } from './parkdean.adapter';
import { ButlinsAdapter } from './butlins.adapter';
import { AwayResortsAdapter } from './awayresorts.adapter'; // [NEW] Adapter import

export class AdapterRegistry {
    private adapters: Map<string, BaseAdapter> = new Map();

    constructor() {
        const hoseasons = new HoseasonsAdapter();
        const haven = new HavenAdapter();
        const centerparcs = new CenterParcsAdapter();
        const parkdean = new ParkdeanAdapter();
        const butlins = new ButlinsAdapter();
        const awayresorts = new AwayResortsAdapter(); // [NEW] Instantiate adapter

        // Register lowercase variants
        this.registerAdapter('hoseasons', hoseasons);
        this.registerAdapter('haven', haven);
        this.registerAdapter('centerparcs', centerparcs);
        this.registerAdapter('parkdean', parkdean);
        this.registerAdapter('butlins', butlins);
        this.registerAdapter('awayresorts', awayresorts); // [NEW] Register adapter

        // Register uppercase variants for robustness
        this.registerAdapter('HOSEASONS', hoseasons);
        this.registerAdapter('HAVEN', haven);
        this.registerAdapter('CENTERPARCS', centerparcs);
        this.registerAdapter('PARKDEAN', parkdean);
        this.registerAdapter('BUTLINS', butlins);
        this.registerAdapter('AWAYRESORTS', awayresorts); // [NEW] Aliase variants for robustness
    }

    registerAdapter(providerCode: string, adapter: BaseAdapter): void {
        this.adapters.set(providerCode, adapter);
    }

    getAdapter(providerCode: string): BaseAdapter {
        const adapter = this.adapters.get(providerCode);
        if (!adapter) {
            throw new Error(`No adapter found for provider: ${providerCode}`);
        }
        return adapter;
    }

    getAllAdapters(): Map<string, BaseAdapter> {
        return this.adapters;
    }

    getProviderMetadata(): Array<{ code: string; name: string; enabled: boolean }> {
        return [
            { code: 'hoseasons', name: 'Hoseasons', enabled: true },
            { code: 'haven', name: 'Haven', enabled: true },
            { code: 'centerparcs', name: 'Center Parcs', enabled: true },
            { code: 'parkdean', name: 'Parkdean Resorts', enabled: true },
            { code: 'butlins', name: 'Butlin\'s', enabled: true },
            { code: 'awayresorts', name: 'Away Resorts', enabled: true }, // [NEW] Metadata
        ];
    }

    async cleanupAll(): Promise<void> {
        for (const adapter of this.adapters.values()) {
            await adapter.cleanup();
        }
    }
}

export const adapterRegistry = new AdapterRegistry();
