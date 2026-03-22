'use client';

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import api from '@/services/api';

const ParksMap = dynamic(
    () => import('@/components/ParksMap').then(m => m.ParksMap),
    { ssr: false, loading: () => <div className="h-[500px] bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">Loading map…</div> }
);

interface Park {
    id: string;
    name: string;
    providerCode: string;
    providerName: string;
    region: string | null;
    latitude: number | null;
    longitude: number | null;
    parkCode: string | null;
}

const PROVIDER_COLOURS: Record<string, string> = {
    haven: 'bg-blue-100 text-blue-800',
    hoseasons: 'bg-green-100 text-green-800',
    centerparcs: 'bg-emerald-100 text-emerald-800',
    butlins: 'bg-red-100 text-red-800',
    parkdean: 'bg-orange-100 text-orange-800',
    awayresorts: 'bg-purple-100 text-purple-800',
};

function providerBadge(code: string, name: string) {
    const cls = PROVIDER_COLOURS[code.toLowerCase()] ?? 'bg-gray-100 text-gray-800';
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
            {name}
        </span>
    );
}

export default function ParksPage() {
    const router = useRouter();
    const [view, setView] = useState<'list' | 'map'>('list');
    const [providerFilter, setProviderFilter] = useState('');
    const [regionFilter, setRegionFilter] = useState('');
    const [search, setSearch] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['parks'],
        queryFn: async () => {
            const { data } = await api.get<{ parks: Park[]; total: number; regions: string[] }>('/parks');
            return data;
        },
    });

    const parks = data?.parks ?? [];
    const regions = data?.regions ?? [];

    // Unique providers for filter dropdown
    const providers = useMemo(() => {
        const seen = new Map<string, string>();
        parks.forEach(p => seen.set(p.providerCode, p.providerName));
        return Array.from(seen.entries()).map(([code, name]) => ({ code, name }));
    }, [parks]);

    const filtered = useMemo(() => {
        return parks.filter(p => {
            if (providerFilter && p.providerCode !== providerFilter) return false;
            if (regionFilter && p.region !== regionFilter) return false;
            if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
            return true;
        });
    }, [parks, providerFilter, regionFilter, search]);

    function handleWatchPark(park: Park) {
        // Navigate to dashboard with provider pre-selected (via query param)
        router.push(`/dashboard?createFor=${park.providerCode}&parkCode=${park.parkCode ?? ''}&parkName=${encodeURIComponent(park.name)}`);
    }

    return (
        <div className="px-4 py-6 sm:px-0">
            <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Parks Browser</h1>
                    <p className="text-sm text-gray-500 mt-1">
                        {isLoading ? 'Loading…' : `${parks.length} parks across ${providers.length} providers`}
                    </p>
                </div>

                {/* View toggle */}
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
                    <button
                        onClick={() => setView('list')}
                        className={`px-4 py-2 font-medium ${view === 'list' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                    >
                        🗂 List
                    </button>
                    <button
                        onClick={() => setView('map')}
                        className={`px-4 py-2 font-medium ${view === 'map' ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                    >
                        🗺️ Map
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 flex flex-wrap gap-4">
                <input
                    type="text"
                    placeholder="Search park name…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="flex-1 min-w-[180px] px-3 py-2 border rounded-md text-sm"
                />
                <select
                    value={providerFilter}
                    onChange={e => setProviderFilter(e.target.value)}
                    className="px-3 py-2 border rounded-md text-sm"
                >
                    <option value="">All providers</option>
                    {providers.map(p => (
                        <option key={p.code} value={p.code}>{p.name}</option>
                    ))}
                </select>
                <select
                    value={regionFilter}
                    onChange={e => setRegionFilter(e.target.value)}
                    className="px-3 py-2 border rounded-md text-sm"
                >
                    <option value="">All regions</option>
                    {regions.map(r => (
                        <option key={r} value={r}>{r}</option>
                    ))}
                </select>
                {(search || providerFilter || regionFilter) && (
                    <button
                        onClick={() => { setSearch(''); setProviderFilter(''); setRegionFilter(''); }}
                        className="px-3 py-2 text-sm text-gray-500 hover:text-gray-800"
                    >
                        Clear filters
                    </button>
                )}
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center min-h-[300px]">
                    <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full"></div>
                </div>
            ) : view === 'map' ? (
                <ParksMap parks={filtered} onWatchPark={handleWatchPark} />
            ) : (
                <>
                    {filtered.length === 0 ? (
                        <div className="text-center py-16 text-gray-500">No parks match your filters.</div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filtered.map(park => (
                                <div key={park.id} className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col gap-3">
                                    <div>
                                        <p className="font-semibold text-gray-900 leading-snug">{park.name}</p>
                                        {park.region && (
                                            <p className="text-xs text-gray-500 mt-0.5">{park.region}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center justify-between">
                                        {providerBadge(park.providerCode, park.providerName)}
                                        {park.latitude && park.longitude && (
                                            <span className="text-xs text-gray-400">📍 on map</span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleWatchPark(park)}
                                        className="mt-auto w-full text-sm bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-700"
                                    >
                                        Watch this park
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    <p className="text-xs text-gray-400 mt-4 text-center">
                        Showing {filtered.length} of {parks.length} parks
                    </p>
                </>
            )}
        </div>
    );
}
