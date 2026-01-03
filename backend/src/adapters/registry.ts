import { BaseAdapter } from './base.adapter';
import { HoseasonsAdapter } from './hoseasons.adapter';
import { HavenAdapter } from './haven.adapter';

export class AdapterRegistry {
    private adapters: Map<string, BaseAdapter> = new Map();

    constructor() {
        this.registerAdapter('hoseasons', new HoseasonsAdapter());
        this.registerAdapter('haven', new HavenAdapter());
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

    async cleanupAll(): Promise<void> {
        for (const adapter of this.adapters.values()) {
            await adapter.cleanup();
        }
    }
}

export const adapterRegistry = new AdapterRegistry();
