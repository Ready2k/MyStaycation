'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
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

interface ProviderSummary {
    provider: string;
    status: string;
    matchedCount: number;
    otherCount: number;
    error?: string;
}

interface OverallSummary {
    totalMatched: number;
    lowestMatchedPriceGbp: number | null;
}

type SortField = 'price' | 'perNight' | 'location';

const ALL_PROVIDERS = [
    { code: 'haven',       name: 'Haven' },
    { code: 'hoseasons',   name: 'Hoseasons' },
    { code: 'centerparcs', name: 'Center Parcs' },
    { code: 'butlins',     name: 'Butlins' },
    { code: 'parkdean',    name: 'Parkdean' },
    { code: 'awayresorts', name: 'Away Resorts' },
];

const PROVIDER_BADGE: Record<string, string> = {
    haven:       'bg-blue-100 text-blue-800',
    hoseasons:   'bg-green-100 text-green-800',
    centerparcs: 'bg-emerald-100 text-emerald-800',
    butlins:     'bg-red-100 text-red-800',
    parkdean:    'bg-orange-100 text-orange-800',
    awayresorts: 'bg-purple-100 text-purple-800',
};

const STATUS_STYLE: Record<string, string> = {
    OK:              'bg-green-100 text-green-700',
    DISABLED:        'bg-gray-100 text-gray-500',
    BLOCKED_ROBOTS:  'bg-amber-100 text-amber-700',
    FETCH_FAILED:    'bg-red-100 text-red-700',
    RATE_LIMITED:    'bg-orange-100 text-orange-700',
};

const STATUS_ICON: Record<string, string> = {
    OK:             '✓',
    DISABLED:       '—',
    BLOCKED_ROBOTS: '⚠',
    FETCH_FAILED:   '✕',
    RATE_LIMITED:   '⏱',
};

function providerLabel(code: string) {
    return ALL_PROVIDERS.find((p) => p.code === code.toLowerCase())?.name ?? code;
}

export default function ComparePage() {
    const router = useRouter();
    const [dateStart, setDateStart]   = useState('');
    const [dateEnd, setDateEnd]       = useState('');
    const [nights, setNights]         = useState(7);
    const [adults, setAdults]         = useState(2);
    const [children, setChildren]     = useState(0);
    const [selectedProviders, setSelectedProviders] = useState<string[]>(
        ALL_PROVIDERS.map((p) => p.code)
    );
    const [results, setResults]           = useState<CompareResult[] | null>(null);
    const [providerSummaries, setProviderSummaries] = useState<ProviderSummary[]>([]);
    const [overallSummary, setOverallSummary] = useState<OverallSummary | null>(null);
    const [sortField, setSortField]       = useState<SortField>('price');
    const [sortAsc, setSortAsc]           = useState(true);
    const [error, setError]               = useState('');

    const compareMutation = useMutation({
        mutationFn: async () => {
            const { data } = await api.post('/search/preview', {
                mode: 'INLINE_PROFILE',
                profile: {
                    providerCode: selectedProviders[0],
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
            const summaries: ProviderSummary[] = [];

            (data.providers ?? []).forEach((p: any) => {
                // Collect provider-level status
                summaries.push({
                    provider: p.provider ?? '',
                    status: p.status ?? 'OK',
                    matchedCount: p.results?.matched?.length ?? 0,
                    otherCount: p.results?.other?.length ?? 0,
                    error: p.error,
                });

                const add = (items: any[]) =>
                    items?.forEach((item: any) => {
                        flat.push({
                            providerKey:  item.providerKey ?? p.provider ?? '',
                            location:     item.location ?? item.parkId ?? 'Unknown',
                            propertyName: item.propertyName ?? item.accommodationType ?? '',
                            price:        Number(item.price ?? 0),
                            stayNights:   item.stayNights ?? nights,
                            stayStartDate: item.stayStartDate ?? dateStart,
                            sourceUrl:    item.sourceUrl ?? '',
                        });
                    });

                add(p.results?.matched ?? []);
                add(p.results?.other ?? []);
            });

            flat.sort((a, b) => a.price - b.price);
            setResults(flat);
            setProviderSummaries(summaries);
            setOverallSummary(data.overallSummary ?? null);
            setSortField('price');
            setSortAsc(true);
            setError('');
        },
        onError: (err: any) => {
            setError(err.response?.data?.message ?? err.message ?? 'Search failed');
        },
    });

    function toggleProvider(code: string) {
        setSelectedProviders((prev) =>
            prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
        );
    }

    function handleSort(field: SortField) {
        if (sortField === field) {
            setSortAsc((a) => !a);
        } else {
            setSortField(field);
            setSortAsc(true);
        }
    }

    function handleWatch(r: CompareResult) {
        const params = new URLSearchParams({ createFor: r.providerKey.toLowerCase() });
        if (r.location && r.location !== 'Unknown') params.set('parkName', r.location);
        router.push(`/dashboard?${params}`);
    }

    const sortedResults = results
        ? [...results].sort((a, b) => {
              let cmp = 0;
              if (sortField === 'price')    cmp = a.price - b.price;
              if (sortField === 'perNight') cmp = (a.price / a.stayNights) - (b.price / b.stayNights);
              if (sortField === 'location') cmp = a.location.localeCompare(b.location);
              return sortAsc ? cmp : -cmp;
          })
        : [];

    function SortHeader({ field, label }: { field: SortField; label: string }) {
        const active = sortField === field;
        return (
            <th
                onClick={() => handleSort(field)}
                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide cursor-pointer hover:bg-gray-100 select-none"
            >
                <span className="flex items-center gap-1">
                    {label}
                    {active && <span className="text-primary-600">{sortAsc ? '↑' : '↓'}</span>}
                    {!active && <span className="text-gray-300">↕</span>}
                </span>
            </th>
        );
    }

    const cheapest = sortedResults[0];
    const failedProviders = providerSummaries.filter((p) => p.status !== 'OK' && p.status !== 'DISABLED');

    return (
        <div className="px-4 py-6 sm:px-0">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Cross-Provider Compare</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Search multiple providers at once and see results ranked by price.
                </p>
            </div>

            {/* Search form */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Check-in</label>
                        <input
                            type="date"
                            required
                            value={dateStart}
                            onChange={(e) => setDateStart(e.target.value)}
                            className="w-full px-3 py-2 border rounded-md text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Check-out</label>
                        <input
                            type="date"
                            required
                            value={dateEnd}
                            onChange={(e) => setDateEnd(e.target.value)}
                            className="w-full px-3 py-2 border rounded-md text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Nights</label>
                        <input
                            type="number"
                            min={1}
                            max={28}
                            value={nights}
                            onChange={(e) => setNights(parseInt(e.target.value))}
                            className="w-full px-3 py-2 border rounded-md text-sm"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Adults</label>
                        <input
                            type="number"
                            min={1}
                            value={adults}
                            onChange={(e) => setAdults(parseInt(e.target.value))}
                            className="w-full px-3 py-2 border rounded-md text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Children</label>
                        <input
                            type="number"
                            min={0}
                            value={children}
                            onChange={(e) => setChildren(parseInt(e.target.value))}
                            className="w-full px-3 py-2 border rounded-md text-sm"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium mb-2">Providers to include</label>
                    <div className="flex flex-wrap gap-2">
                        {ALL_PROVIDERS.map((p) => (
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
                    disabled={
                        compareMutation.isPending ||
                        !dateStart ||
                        !dateEnd ||
                        selectedProviders.length === 0
                    }
                    className="w-full py-2.5 bg-primary-600 text-white font-medium rounded-md hover:bg-primary-700 disabled:opacity-50"
                >
                    {compareMutation.isPending ? (
                        <span className="flex items-center justify-center gap-2">
                            <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                            Searching across {selectedProviders.length} provider{selectedProviders.length !== 1 ? 's' : ''}…
                        </span>
                    ) : (
                        '🔍 Compare Prices'
                    )}
                </button>
            </div>

            {/* Results */}
            {results !== null && (
                <div className="space-y-4">
                    {/* Provider status row */}
                    {providerSummaries.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {providerSummaries.map((ps) => {
                                const style = STATUS_STYLE[ps.status] ?? 'bg-gray-100 text-gray-600';
                                const icon = STATUS_ICON[ps.status] ?? '?';
                                return (
                                    <div
                                        key={ps.provider}
                                        title={ps.error ?? ps.status}
                                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${style}`}
                                    >
                                        <span>{icon}</span>
                                        <span>{providerLabel(ps.provider)}</span>
                                        {ps.status === 'OK' && (
                                            <span className="opacity-70">({ps.matchedCount})</span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Warning for any failed providers */}
                    {failedProviders.length > 0 && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                            {failedProviders.map((p) => providerLabel(p.provider)).join(', ')} could not be searched ({failedProviders[0].status.replace(/_/g, ' ').toLowerCase()}). Results may be incomplete.
                        </div>
                    )}

                    {/* Best price callout */}
                    {cheapest && cheapest.price > 0 && overallSummary?.lowestMatchedPriceGbp != null && (
                        <div className="bg-green-50 border border-green-200 rounded-lg px-5 py-4 flex items-center justify-between flex-wrap gap-3">
                            <div>
                                <p className="text-sm font-semibold text-green-800">Cheapest matched result</p>
                                <p className="text-sm text-green-700 mt-0.5">
                                    {cheapest.location} · {providerLabel(cheapest.providerKey)} ·{' '}
                                    {cheapest.stayNights} nights
                                </p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="text-right">
                                    <p className="text-2xl font-bold text-green-700">
                                        £{overallSummary.lowestMatchedPriceGbp.toLocaleString()}
                                    </p>
                                    <p className="text-xs text-green-600">
                                        £{(overallSummary.lowestMatchedPriceGbp / cheapest.stayNights).toFixed(0)}/night
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleWatch(cheapest)}
                                    className="text-sm px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors whitespace-nowrap"
                                >
                                    + Watch this
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Results table */}
                    <div className="bg-white rounded-lg border border-gray-200">
                        <div className="px-5 py-4 border-b flex items-center justify-between flex-wrap gap-2">
                            <h2 className="text-base font-semibold text-gray-900">All Results</h2>
                            <span className="text-sm text-gray-500">
                                {results.length} result{results.length !== 1 ? 's' : ''} · click headers to sort
                            </span>
                        </div>

                        {results.length === 0 ? (
                            <div className="px-6 py-12 text-center text-gray-500">
                                No results found. Try widening your date range or including more providers.
                            </div>
                        ) : (
                            <>
                                {/* Desktop table */}
                                <div className="hidden sm:block overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-100 text-sm">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide w-6">
                                                    #
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                                                    Provider
                                                </th>
                                                <SortHeader field="location" label="Location" />
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                                                    Accommodation
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                                                    Date
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide">
                                                    Nights
                                                </th>
                                                <SortHeader field="price"    label="Total" />
                                                <SortHeader field="perNight" label="/Night" />
                                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wide">
                                                    Actions
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {sortedResults.map((r, i) => {
                                                const isCheapest = i === 0 && sortField === 'price' && sortAsc;
                                                const perNight = r.stayNights > 0 ? r.price / r.stayNights : 0;
                                                return (
                                                    <tr
                                                        key={i}
                                                        className={`${isCheapest ? 'bg-green-50' : 'hover:bg-gray-50'}`}
                                                    >
                                                        <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                                                        <td className="px-4 py-3">
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PROVIDER_BADGE[r.providerKey.toLowerCase()] ?? 'bg-gray-100 text-gray-800'}`}>
                                                                {providerLabel(r.providerKey)}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-900 font-medium">
                                                            {r.location}
                                                            {isCheapest && (
                                                                <span className="ml-2 text-xs text-green-600 font-semibold">★ Best</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-500">{r.propertyName || '—'}</td>
                                                        <td className="px-4 py-3 text-gray-600">
                                                            {r.stayStartDate
                                                                ? new Date(r.stayStartDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                                                                : '—'}
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-600">{r.stayNights}n</td>
                                                        <td className="px-4 py-3 font-semibold text-gray-900">
                                                            {r.price > 0 ? `£${r.price.toLocaleString()}` : '—'}
                                                        </td>
                                                        <td className="px-4 py-3 text-gray-500">
                                                            {perNight > 0 ? `£${perNight.toFixed(0)}` : '—'}
                                                        </td>
                                                        <td className="px-4 py-3">
                                                            <div className="flex items-center justify-center gap-2">
                                                                {r.sourceUrl && (
                                                                    <a
                                                                        href={r.sourceUrl}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="text-xs px-2 py-1 bg-primary-600 hover:bg-primary-700 text-white rounded font-medium transition-colors"
                                                                    >
                                                                        Book ↗
                                                                    </a>
                                                                )}
                                                                <button
                                                                    onClick={() => handleWatch(r)}
                                                                    className="text-xs px-2 py-1 border border-green-600 text-green-700 hover:bg-green-50 rounded font-medium transition-colors whitespace-nowrap"
                                                                >
                                                                    + Watch
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile cards */}
                                <div className="sm:hidden divide-y divide-gray-100">
                                    {sortedResults.map((r, i) => {
                                        const isCheapest = i === 0 && sortField === 'price' && sortAsc;
                                        const perNight = r.stayNights > 0 ? r.price / r.stayNights : 0;
                                        return (
                                            <div key={i} className={`p-4 ${isCheapest ? 'bg-green-50' : ''}`}>
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PROVIDER_BADGE[r.providerKey.toLowerCase()] ?? 'bg-gray-100 text-gray-800'}`}>
                                                                {providerLabel(r.providerKey)}
                                                            </span>
                                                            {isCheapest && (
                                                                <span className="text-xs text-green-600 font-semibold">★ Best price</span>
                                                            )}
                                                        </div>
                                                        <p className="font-semibold text-gray-900 text-sm">{r.location}</p>
                                                        {r.propertyName && (
                                                            <p className="text-xs text-gray-500">{r.propertyName}</p>
                                                        )}
                                                        <p className="text-xs text-gray-500 mt-0.5">
                                                            {r.stayStartDate
                                                                ? new Date(r.stayStartDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                                                                : '—'}{' '}
                                                            · {r.stayNights} nights
                                                        </p>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <p className="text-lg font-bold text-gray-900">
                                                            {r.price > 0 ? `£${r.price.toLocaleString()}` : '—'}
                                                        </p>
                                                        {perNight > 0 && (
                                                            <p className="text-xs text-gray-500">£{perNight.toFixed(0)}/night</p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2 mt-3">
                                                    {r.sourceUrl && (
                                                        <a
                                                            href={r.sourceUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="flex-1 text-center text-xs px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-md font-medium transition-colors"
                                                        >
                                                            Book ↗
                                                        </a>
                                                    )}
                                                    <button
                                                        onClick={() => handleWatch(r)}
                                                        className="flex-1 text-xs px-3 py-1.5 border border-green-600 text-green-700 hover:bg-green-50 rounded-md font-medium transition-colors"
                                                    >
                                                        + Watch this park
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
