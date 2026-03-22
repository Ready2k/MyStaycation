'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
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
        code: string;
        name: string;
    };
}

const PROVIDER_COLOURS: Record<string, string> = {
    haven: 'bg-blue-100 text-blue-800',
    hoseasons: 'bg-green-100 text-green-800',
    centerparcs: 'bg-emerald-100 text-emerald-800',
    butlins: 'bg-red-100 text-red-800',
    parkdean: 'bg-orange-100 text-orange-800',
    awayresorts: 'bg-purple-100 text-purple-800',
};

function discountLabel(deal: Deal): string {
    switch (deal.discountType) {
        case 'PERCENT_OFF':
            return deal.discountValue ? `${deal.discountValue}% OFF` : 'Discount';
        case 'FIXED_OFF':
            return deal.discountValue ? `£${deal.discountValue} OFF` : 'Saving';
        case 'SALE_PRICE':
            return deal.discountValue ? `From £${deal.discountValue}` : 'Sale Price';
        case 'PERK':
            return 'Free Perk';
        default:
            return 'Deal';
    }
}

function discountColour(deal: Deal): string {
    switch (deal.discountType) {
        case 'PERCENT_OFF':
        case 'FIXED_OFF':
            return 'bg-green-600';
        case 'SALE_PRICE':
            return 'bg-blue-600';
        case 'PERK':
            return 'bg-purple-600';
        default:
            return 'bg-gray-600';
    }
}

function CopyButton({ code }: { code: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            onClick={handleCopy}
            className="ml-2 text-xs px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 transition-colors"
        >
            {copied ? '✓ Copied' : 'Copy'}
        </button>
    );
}

export default function DealsPage() {
    const [providerFilter, setProviderFilter] = useState('');
    const [page, setPage] = useState(1);

    const { data, isLoading, error } = useQuery({
        queryKey: ['deals', providerFilter, page],
        queryFn: async () => {
            const params = new URLSearchParams({ page: String(page), limit: '24' });
            if (providerFilter) params.set('provider', providerFilter);
            const { data } = await api.get(`/deals?${params}`);
            return data;
        },
    });

    const deals: Deal[] = data?.deals || [];
    const totalPages: number = data?.pages || 1;

    return (
        <div className="px-4 py-6 sm:px-0">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Active Deals & Vouchers</h1>
                <p className="mt-1 text-sm text-gray-500">
                    Live promotions and discount codes detected across UK holiday providers.
                </p>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-3 mb-6">
                <label className="text-sm font-medium text-gray-700">Filter by provider:</label>
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
                </select>
                {data?.total !== undefined && (
                    <span className="text-sm text-gray-500">{data.total} deal{data.total !== 1 ? 's' : ''} found</span>
                )}
            </div>

            {isLoading && (
                <div className="text-center py-12 text-gray-500">Loading deals...</div>
            )}

            {error && (
                <div className="text-center py-12 text-red-600">Failed to load deals. Please try again.</div>
            )}

            {!isLoading && !error && deals.length === 0 && (
                <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="text-4xl mb-3">🎫</div>
                    <h3 className="text-sm font-semibold text-gray-900">No active deals found</h3>
                    <p className="mt-1 text-sm text-gray-500">
                        Deals are discovered automatically when the monitoring jobs run.
                    </p>
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {deals.map((deal) => (
                    <div
                        key={deal.id}
                        className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                    >
                        {/* Header strip */}
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

                        <div className="p-4">
                            <h3 className="font-semibold text-gray-900 leading-snug">{deal.title}</h3>

                            {/* Voucher code */}
                            {deal.voucherCode && (
                                <div className="mt-3 flex items-center">
                                    <span className="text-xs font-medium text-gray-500 mr-2">Code:</span>
                                    <code className="bg-yellow-50 border border-yellow-200 text-yellow-900 text-sm font-mono px-2 py-0.5 rounded">
                                        {deal.voucherCode}
                                    </code>
                                    <CopyButton code={deal.voucherCode} />
                                </div>
                            )}

                            {/* Eligibility tags */}
                            {deal.eligibilityTags && deal.eligibilityTags.filter(Boolean).length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1">
                                    {deal.eligibilityTags.filter(Boolean).map((tag) => (
                                        <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}

                            {/* Restrictions */}
                            {deal.restrictions && Object.keys(deal.restrictions).length > 0 && (
                                <p className="mt-2 text-xs text-gray-500 italic">
                                    {Object.entries(deal.restrictions)
                                        .map(([k, v]) => `${k}: ${v}`)
                                        .join(' · ')}
                                </p>
                            )}

                            {/* Expiry */}
                            <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                                <span>
                                    {deal.endsAt
                                        ? `Expires ${new Date(deal.endsAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
                                        : 'No expiry date'}
                                </span>
                                <span title={`Last seen: ${new Date(deal.lastSeenAt).toLocaleString()}`}>
                                    Seen {new Date(deal.lastSeenAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-2">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-50"
                    >
                        Previous
                    </button>
                    <span className="text-sm text-gray-600">Page {page} of {totalPages}</span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded-md disabled:opacity-40 hover:bg-gray-50"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}
