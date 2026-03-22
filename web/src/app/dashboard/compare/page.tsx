'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import api from '@/services/api';

interface CompareResult {
    providerKey: string;
    location: string;
    propertyName: string;
    price: number;
    stayNights: number;
    stayStartDate: string;
    sourceUrl: string;
}

const ALL_PROVIDERS = [
    { code: 'haven', name: 'Haven' },
    { code: 'hoseasons', name: 'Hoseasons' },
    { code: 'centerparcs', name: 'Center Parcs' },
    { code: 'butlins', name: 'Butlins' },
    { code: 'parkdean', name: 'Parkdean' },
    { code: 'awayresorts', name: 'Away Resorts' },
];

const PROVIDER_BADGE: Record<string, string> = {
    haven: 'bg-blue-100 text-blue-800',
    hoseasons: 'bg-green-100 text-green-800',
    centerparcs: 'bg-emerald-100 text-emerald-800',
    butlins: 'bg-red-100 text-red-800',
    parkdean: 'bg-orange-100 text-orange-800',
    awayresorts: 'bg-purple-100 text-purple-800',
};

export default function ComparePage() {
    const [dateStart, setDateStart] = useState('');
    const [dateEnd, setDateEnd] = useState('');
    const [nights, setNights] = useState(7);
    const [adults, setAdults] = useState(2);
    const [children, setChildren] = useState(0);
    const [selectedProviders, setSelectedProviders] = useState<string[]>(ALL_PROVIDERS.map(p => p.code));
    const [results, setResults] = useState<CompareResult[] | null>(null);
    const [error, setError] = useState('');

    const compareMutation = useMutation({
        mutationFn: async () => {
            const { data } = await api.post('/search/preview', {
                mode: 'INLINE_PROFILE',
                profile: {
                    providerCode: selectedProviders[0], // required but overridden by providers array
                    dateStart,
                    dateEnd,
                    durationNightsMin: nights,
                    durationNightsMax: nights,
                    partySizeAdults: adults,
                    partySizeChildren: children,
                    flexType: 'RANGE',
                },
                providers: selectedProviders,
                options: {
                    maxResults: 50,
                    includeMismatches: true,
                    includeDebug: false,
                },
            });
            return data;
        },
        onSuccess: (data) => {
            const flat: CompareResult[] = [];
            (data.providers ?? []).forEach((p: any) => {
                const add = (items: any[]) => items?.forEach((item: any) => {
                    flat.push({
                        providerKey: item.providerKey ?? p.provider ?? '',
                        location: item.location ?? item.parkId ?? 'Unknown',
                        propertyName: item.propertyName ?? item.accommodationType ?? '',
                        price: Number(item.price ?? 0),
                        stayNights: item.stayNights ?? nights,
                        stayStartDate: item.stayStartDate ?? dateStart,
                        sourceUrl: item.sourceUrl ?? '',
                    });
                });
                add(p.results?.matched ?? []);
                add(p.results?.other ?? []);
            });
            // Sort cheapest first
            flat.sort((a, b) => a.price - b.price);
            setResults(flat);
            setError('');
        },
        onError: (err: any) => {
            setError(err.response?.data?.message ?? err.message ?? 'Search failed');
        },
    });

    function toggleProvider(code: string) {
        setSelectedProviders(prev =>
            prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
        );
    }

    const providerLabel = (code: string) =>
        ALL_PROVIDERS.find(p => p.code === code)?.name ?? code;

    return (
        <div className="px-4 py-6 sm:px-0">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Cross-Provider Compare</h1>
                <p className="text-sm text-gray-500 mt-1">Search multiple providers at once and see results ranked by price.</p>
            </div>

            {/* Search form */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Check-in</label>
                        <input type="date" required value={dateStart} onChange={e => setDateStart(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Check-out</label>
                        <input type="date" required value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Nights</label>
                        <input type="number" min={1} max={28} value={nights} onChange={e => setNights(parseInt(e.target.value))} className="w-full px-3 py-2 border rounded-md text-sm" />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Adults</label>
                        <input type="number" min={1} value={adults} onChange={e => setAdults(parseInt(e.target.value))} className="w-full px-3 py-2 border rounded-md text-sm" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Children</label>
                        <input type="number" min={0} value={children} onChange={e => setChildren(parseInt(e.target.value))} className="w-full px-3 py-2 border rounded-md text-sm" />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2">Providers to include</label>
                    <div className="flex flex-wrap gap-2">
                        {ALL_PROVIDERS.map(p => (
                            <button
                                key={p.code}
                                type="button"
                                onClick={() => toggleProvider(p.code)}
                                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                                    selectedProviders.includes(p.code)
                                        ? 'bg-primary-600 text-white border-primary-600'
                                        : 'bg-white text-gray-600 border-gray-300 hover:border-gray-500'
                                }`}
                            >
                                {p.name}
                            </button>
                        ))}
                    </div>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <button
                    onClick={() => compareMutation.mutate()}
                    disabled={compareMutation.isPending || !dateStart || !dateEnd || selectedProviders.length === 0}
                    className="w-full py-2.5 bg-primary-600 text-white font-medium rounded-md hover:bg-primary-700 disabled:opacity-50"
                >
                    {compareMutation.isPending ? (
                        <span className="flex items-center justify-center gap-2">
                            <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span>
                            Searching across {selectedProviders.length} providers…
                        </span>
                    ) : (
                        '🔍 Compare Prices'
                    )}
                </button>
            </div>

            {/* Results */}
            {results !== null && (
                <div className="bg-white rounded-lg border border-gray-200">
                    <div className="px-6 py-4 border-b flex items-center justify-between">
                        <h2 className="text-lg font-semibold">Results</h2>
                        <span className="text-sm text-gray-500">{results.length} results — sorted by price</span>
                    </div>

                    {results.length === 0 ? (
                        <div className="px-6 py-12 text-center text-gray-500">No results found for these criteria.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 text-sm">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left font-medium text-gray-500">Provider</th>
                                        <th className="px-4 py-3 text-left font-medium text-gray-500">Location</th>
                                        <th className="px-4 py-3 text-left font-medium text-gray-500">Accommodation</th>
                                        <th className="px-4 py-3 text-left font-medium text-gray-500">Dates</th>
                                        <th className="px-4 py-3 text-left font-medium text-gray-500">Nights</th>
                                        <th className="px-4 py-3 text-right font-medium text-gray-500">Price</th>
                                        <th className="px-4 py-3 text-center font-medium text-gray-500">Link</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {results.map((r, i) => (
                                        <tr key={i} className={i === 0 ? 'bg-green-50' : 'hover:bg-gray-50'}>
                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PROVIDER_BADGE[r.providerKey.toLowerCase()] ?? 'bg-gray-100 text-gray-800'}`}>
                                                    {providerLabel(r.providerKey)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-900">{r.location}</td>
                                            <td className="px-4 py-3 text-gray-600">{r.propertyName || '—'}</td>
                                            <td className="px-4 py-3 text-gray-600">{r.stayStartDate ? new Date(r.stayStartDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                                            <td className="px-4 py-3 text-gray-600">{r.stayNights}n</td>
                                            <td className="px-4 py-3 text-right font-semibold text-gray-900">
                                                {r.price > 0 ? `£${r.price.toLocaleString()}` : '—'}
                                                {i === 0 && <span className="ml-1 text-xs text-green-600">✓ cheapest</span>}
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {r.sourceUrl ? (
                                                    <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">
                                                        Book →
                                                    </a>
                                                ) : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
