'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/services/api';

interface Deal {
    id: string;
    title: string;
    source: string;
    discountType: 'PERCENT_OFF' | 'FIXED_OFF' | 'SALE_PRICE' | 'PERK';
    discountValue?: number;
    voucherCode?: string;
    eligibilityTags: string[];
    restrictions?: Record<string, unknown>;
    startsAt?: string;
    endsAt?: string;
    confidence: number;
    detectedAt: string;
    lastSeenAt: string;
    provider?: {
        id: string;
        code: string;
        name: string;
        baseUrl: string;
    };
}

const PROVIDER_COLOURS: Record<string, string> = {
    haven: 'bg-blue-100 text-blue-800',
    hoseasons: 'bg-green-100 text-green-800',
    centerparcs: 'bg-emerald-100 text-emerald-800',
    butlins: 'bg-red-100 text-red-800',
    parkdean: 'bg-orange-100 text-orange-800',
    awayresorts: 'bg-purple-100 text-purple-800',
    forestholidays: 'bg-teal-100 text-teal-800',
};

function discountLabel(deal: Deal): string {
    switch (deal.discountType) {
        case 'PERCENT_OFF': return deal.discountValue ? `${deal.discountValue}% OFF` : 'Discount';
        case 'FIXED_OFF': return deal.discountValue ? `£${deal.discountValue} OFF` : 'Saving';
        case 'SALE_PRICE': return deal.discountValue ? `From £${deal.discountValue}` : 'Sale Price';
        case 'PERK': return 'Free Perk';
        default: return 'Deal';
    }
}

function discountColour(deal: Deal): string {
    switch (deal.discountType) {
        case 'PERCENT_OFF':
        case 'FIXED_OFF': return 'bg-green-600';
        case 'SALE_PRICE': return 'bg-blue-600';
        case 'PERK': return 'bg-purple-600';
        default: return 'bg-gray-600';
    }
}

function formatRestriction(key: string, value: unknown): string {
    const val = String(value);
    switch (key) {
        case 'stayNights': return `${val} nights`;
        case 'stayStartDate': {
            try { return new Date(val).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
            catch { return val; }
        }
        case 'parkName': return val;
        case 'minAdvance': return `Book ${val}+ days ahead`;
        case 'maxAdvance': return `Up to ${val} days ahead`;
        case 'minPartySize': return `Min ${val} guests`;
        default: return `${key.replace(/([A-Z])/g, ' $1').toLowerCase()}: ${val}`;
    }
}

function formatTag(tag: string): string {
    return tag.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function stayInfoFromRestrictions(restrictions?: Record<string, unknown>): string | null {
    if (!restrictions) return null;
    const nights = restrictions.stayNights ? `${restrictions.stayNights} nights` : null;
    const date = restrictions.stayStartDate
        ? (() => {
              try { return new Date(String(restrictions.stayStartDate)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); }
              catch { return String(restrictions.stayStartDate); }
          })()
        : null;
    const parts = [nights, date].filter(Boolean);
    return parts.length > 0 ? parts.join(' from ') : null;
}

function CopyButton({ code }: { code: string }) {
    const [copied, setCopied] = useState(false);
    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(code).then(() => {
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                });
            }}
            className="ml-2 text-xs px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 transition-colors"
        >
            {copied ? '✓ Copied' : 'Copy'}
        </button>
    );
}

function DealDrawer({ deal, onClose, onWatch }: { deal: Deal; onClose: () => void; onWatch: (deal: Deal) => void }) {
    return (
        <>
            <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
            <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
                {/* Header */}
                <div className="flex items-start justify-between p-6 border-b">
                    <div className="flex-1 pr-4">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                            {deal.provider && (
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${PROVIDER_COLOURS[deal.provider.code] || 'bg-gray-100 text-gray-800'}`}>
                                    {deal.provider.name}
                                </span>
                            )}
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold text-white ${discountColour(deal)}`}>
                                {discountLabel(deal)}
                            </span>
                        </div>
                        <h2 className="text-lg font-bold text-gray-900 leading-snug">{deal.title}</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none mt-1 flex-shrink-0">
                        ×
                    </button>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {deal.voucherCode && (
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Voucher Code</p>
                            <div className="flex items-center">
                                <code className="bg-yellow-50 border border-yellow-200 text-yellow-900 text-base font-mono px-3 py-1.5 rounded">
                                    {deal.voucherCode}
                                </code>
                                <CopyButton code={deal.voucherCode} />
                            </div>
                        </div>
                    )}

                    {deal.restrictions && Object.keys(deal.restrictions).length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Stay Details</p>
                            <ul className="space-y-1">
                                {Object.entries(deal.restrictions).map(([k, v]) => (
                                    <li key={k} className="text-sm text-gray-700 flex items-start gap-2">
                                        <span className="text-gray-400 mt-0.5">•</span>
                                        {formatRestriction(k, v)}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {deal.eligibilityTags?.filter(Boolean).length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Eligibility</p>
                            <div className="flex flex-wrap gap-1.5">
                                {deal.eligibilityTags.filter(Boolean).map((tag) => (
                                    <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                        {formatTag(tag)}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Dates</p>
                        <div className="text-sm text-gray-700 space-y-0.5">
                            {deal.startsAt && (
                                <p>Starts: {new Date(deal.startsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                            )}
                            <p>
                                {deal.endsAt
                                    ? `Expires: ${new Date(deal.endsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`
                                    : 'No expiry date set'}
                            </p>
                            <p className="text-gray-400 text-xs mt-1">
                                Last confirmed: {new Date(deal.lastSeenAt).toLocaleString('en-GB')}
                            </p>
                        </div>
                    </div>

                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Deal Confidence</p>
                        <div className="flex items-center gap-2">
                            <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div
                                    className="bg-green-500 h-2 rounded-full transition-all"
                                    style={{ width: `${Math.round(deal.confidence * 100)}%` }}
                                />
                            </div>
                            <span className="text-xs text-gray-500 w-8 text-right">{Math.round(deal.confidence * 100)}%</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">How reliably this deal was detected from the provider.</p>
                    </div>
                </div>

                {/* Action footer */}
                <div className="border-t p-6 space-y-3 bg-gray-50">
                    {deal.provider?.baseUrl && (
                        <a
                            href={deal.provider.baseUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                            View deal on {deal.provider.name}
                            <span className="text-xs opacity-80">↗</span>
                        </a>
                    )}
                    <button
                        onClick={() => onWatch(deal)}
                        className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        + Create price watcher for this deal
                    </button>
                    {deal.provider && (
                        <a
                            href={`/dashboard/parks?provider=${deal.provider.code}`}
                            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                        >
                            Browse all {deal.provider.name} parks
                        </a>
                    )}
                </div>
            </div>
        </>
    );
}

export default function DealsPage() {
    const router = useRouter();
    const [providerFilter, setProviderFilter] = useState('');
    const [sortBy, setSortBy] = useState<'newest' | 'expiring' | 'saving'>('newest');

    // Support ?provider=<code> deep-links (e.g. from Alerts drawer)
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const p = params.get('provider');
        if (p) setProviderFilter(p);
    }, []);
    const [page, setPage] = useState(1);
    const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);

    const { data, isLoading, error } = useQuery({
        queryKey: ['deals', providerFilter, page],
        queryFn: async () => {
            const params = new URLSearchParams({ page: String(page), limit: '48' });
            if (providerFilter) params.set('provider', providerFilter);
            const { data } = await api.get(`/deals?${params}`);
            return data;
        },
    });

    const deals: Deal[] = data?.deals || [];
    const totalPages: number = data?.pages || 1;

    const sortedDeals = useMemo(() => {
        const copy = [...deals];
        switch (sortBy) {
            case 'expiring':
                return copy.sort((a, b) => {
                    if (!a.endsAt && !b.endsAt) return 0;
                    if (!a.endsAt) return 1;
                    if (!b.endsAt) return -1;
                    return new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime();
                });
            case 'saving':
                return copy.sort((a, b) => (b.discountValue ?? 0) - (a.discountValue ?? 0));
            default:
                return copy.sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());
        }
    }, [deals, sortBy]);

    function handleWatch(deal: Deal) {
        if (!deal.provider) return;
        const parkName = deal.restrictions?.parkName as string | undefined;
        const startDate = deal.restrictions?.stayStartDate as string | undefined;
        const nights = deal.restrictions?.stayNights as number | string | undefined;
        const isPetFriendly = deal.eligibilityTags?.includes('PET_FRIENDLY');

        const params = new URLSearchParams({ createFor: deal.provider.code });
        if (parkName) params.set('parkName', parkName);
        if (startDate) params.set('startDate', startDate);
        if (nights) params.set('nights', String(nights));
        if (deal.title) params.set('dealTitle', deal.title);
        if (isPetFriendly) params.set('isPetFriendly', 'true');
        
        router.push(`/dashboard?${params}`);
    }

    return (
        <div className="px-4 py-6 sm:px-0">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Active Deals & Vouchers</h1>
                <p className="mt-1 text-sm text-gray-500">
                    Live promotions and discount codes detected across UK holiday providers. Click any deal for full details and actions.
                </p>
            </div>

            {/* Filters + Sort */}
            <div className="flex flex-wrap items-center gap-3 mb-6">
                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700">Provider:</label>
                    <select
                        value={providerFilter}
                        onChange={(e) => { setProviderFilter(e.target.value); setPage(1); }}
                        className="rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
                    >
                        <option value="">All providers</option>
                        <option value="haven">Haven</option>
                        <option value="hoseasons">Hoseasons</option>
                        <option value="centerparcs">Center Parcs</option>
                        <option value="butlins">Butlins</option>
                        <option value="parkdean">Parkdean</option>
                        <option value="awayresorts">Away Resorts</option>
                        <option value="forestholidays">Forest Holidays</option>
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700">Sort:</label>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                        className="rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
                    >
                        <option value="newest">Newest first</option>
                        <option value="expiring">Expiring soon</option>
                        <option value="saving">Biggest saving</option>
                    </select>
                </div>

                {data?.total !== undefined && (
                    <span className="text-sm text-gray-500 ml-auto">
                        {data.total} deal{data.total !== 1 ? 's' : ''} found
                    </span>
                )}
            </div>

            {isLoading && (
                <div className="flex items-center justify-center min-h-[300px]">
                    <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full" />
                </div>
            )}

            {error && (
                <div className="text-center py-12 text-red-600">Failed to load deals. Please try again.</div>
            )}

            {!isLoading && !error && sortedDeals.length === 0 && (
                <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="text-4xl mb-3">🎫</div>
                    <h3 className="text-sm font-semibold text-gray-900">No active deals found</h3>
                    <p className="mt-1 text-sm text-gray-500">
                        Deals are discovered automatically when the monitoring jobs run.
                    </p>
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sortedDeals.map((deal) => {
                    const stayInfo = stayInfoFromRestrictions(deal.restrictions);
                    return (
                        <div
                            key={deal.id}
                            onClick={() => setSelectedDeal(deal)}
                            className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md hover:border-primary-300 transition-all cursor-pointer flex flex-col"
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between px-4 pt-4">
                                {deal.provider && (
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${PROVIDER_COLOURS[deal.provider.code] || 'bg-gray-100 text-gray-800'}`}>
                                        {deal.provider.name}
                                    </span>
                                )}
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold text-white ${discountColour(deal)}`}>
                                    {discountLabel(deal)}
                                </span>
                            </div>

                            {/* Body */}
                            <div className="p-4 flex-1 flex flex-col">
                                <h3 className="font-semibold text-gray-900 leading-snug">{deal.title}</h3>

                                {stayInfo && (
                                    <p className="mt-1 text-sm text-gray-500">{stayInfo}</p>
                                )}

                                {deal.voucherCode && (
                                    <div className="mt-2 flex items-center">
                                        <span className="text-xs font-medium text-gray-500 mr-2">Code:</span>
                                        <code className="bg-yellow-50 border border-yellow-200 text-yellow-900 text-sm font-mono px-2 py-0.5 rounded">
                                            {deal.voucherCode}
                                        </code>
                                        <CopyButton code={deal.voucherCode} />
                                    </div>
                                )}

                                {deal.eligibilityTags?.filter(Boolean).length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {deal.eligibilityTags.filter(Boolean).map((tag) => (
                                            <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                                {formatTag(tag)}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Expiry + seen */}
                                <div className="mt-auto pt-3 flex items-center justify-between text-xs text-gray-400">
                                    <span>
                                        {deal.endsAt
                                            ? `Expires ${new Date(deal.endsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                                            : 'No expiry date'}
                                    </span>
                                    <span title={`Last seen: ${new Date(deal.lastSeenAt).toLocaleString()}`}>
                                        Seen {new Date(deal.lastSeenAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                    </span>
                                </div>

                                {/* Quick action buttons */}
                                <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
                                    {deal.provider?.baseUrl && (
                                        <a
                                            href={deal.provider.baseUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="flex-1 text-center text-xs px-2 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-md font-medium transition-colors"
                                        >
                                            View Deal ↗
                                        </a>
                                    )}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleWatch(deal); }}
                                        className="flex-1 text-xs px-2 py-1.5 border border-green-600 text-green-700 hover:bg-green-50 rounded-md font-medium transition-colors"
                                    >
                                        + Watch
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setSelectedDeal(deal); }}
                                        className="text-xs px-2 py-1.5 border border-gray-300 text-gray-500 hover:bg-gray-50 rounded-md transition-colors"
                                        title="Full details"
                                    >
                                        Details
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-2">
                    <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-50"
                    >
                        Previous
                    </button>
                    <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
                    <button
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-50"
                    >
                        Next
                    </button>
                </div>
            )}

            {/* Detail drawer */}
            {selectedDeal && (
                <DealDrawer
                    deal={selectedDeal}
                    onClose={() => setSelectedDeal(null)}
                    onWatch={(deal) => { setSelectedDeal(null); handleWatch(deal); }}
                />
            )}
        </div>
    );
}
