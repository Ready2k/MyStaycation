import { BaseAdapter } from './base.adapter';
import { HoseasonsAdapter } from './hoseasons.adapter';
import { HavenAdapter } from './haven.adapter';
import { CenterParcsAdapter } from './centerparcs.adapter';

export class AdapterRegistry {
    private adapters: Map<string, BaseAdapter> = new Map();

    constructor() {
        const hoseasons = new HoseasonsAdapter();
        const haven = new HavenAdapter();
        const centerparcs = new CenterParcsAdapter();

        // Register lowercase variants
        this.registerAdapter('hoseasons', hoseasons);
        this.registerAdapter('haven', haven);
        this.registerAdapter('centerparcs', centerparcs);

        // Register uppercase variants for robustness
        this.registerAdapter('HOSEASONS', hoseasons);
        this.registerAdapter('HAVEN', haven);
        this.registerAdapter('CENTERPARCS', centerparcs);
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
            { code: 'centerparcs', name: 'Center Parcs', enabled: true }
        ];
    }

    async cleanupAll(): Promise<void> {
        for (const adapter of this.adapters.values()) {
            await adapter.cleanup();
        }
    }
}

export const adapterRegistry = new AdapterRegistry();
