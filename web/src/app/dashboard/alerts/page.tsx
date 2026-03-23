'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/services/api';

interface AlertDetails {
    previousPrice?: number;
    currentPrice?: number;
    percentDrop?: number;
    percentRise?: number;
    days?: number;
    lowestPrice?: number;
    voucherCode?: string;
    [key: string]: unknown;
}

interface Alert {
    id: string;
    status: 'PENDING' | 'SENT' | 'DISMISSED' | 'FAILED';
    channel: string;
    sentAt?: string;
    createdAt: string;
    insight: {
        id: string;
        type: string;
        summary: string;
        details: AlertDetails;
        fingerprint?: {
            id: string;
            snoozedUntil?: string;
            profile: {
                id: string;
                name: string;
            };
            provider?: {
                code: string;
                name: string;
                baseUrl: string;
            };
            park?: {
                name: string;
                region?: string;
            };
        };
    };
}

const INSIGHT_META: Record<string, { icon: string; label: string; colour: string; border: string }> = {
    PRICE_DROP_PERCENT:    { icon: '💰', label: 'Price Drop',      colour: 'bg-green-100 text-green-800',  border: 'border-l-green-500' },
    LOWEST_IN_X_DAYS:     { icon: '🎯', label: 'Lowest Price',     colour: 'bg-emerald-100 text-emerald-800', border: 'border-l-emerald-500' },
    RISK_RISING:          { icon: '⚠️', label: 'Price Rising',     colour: 'bg-amber-100 text-amber-800',  border: 'border-l-amber-500' },
    NEW_CAMPAIGN_DETECTED:{ icon: '🎉', label: 'New Campaign',     colour: 'bg-blue-100 text-blue-800',    border: 'border-l-blue-500' },
    VOUCHER_SPOTTED:      { icon: '🎫', label: 'Voucher Spotted',  colour: 'bg-purple-100 text-purple-800', border: 'border-l-purple-500' },
};

const PROVIDER_COLOURS: Record<string, string> = {
    haven: 'bg-blue-100 text-blue-800',
    hoseasons: 'bg-green-100 text-green-800',
    centerparcs: 'bg-emerald-100 text-emerald-800',
    butlins: 'bg-red-100 text-red-800',
    parkdean: 'bg-orange-100 text-orange-800',
    awayresorts: 'bg-purple-100 text-purple-800',
};

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function PriceChange({ details }: { details: AlertDetails }) {
    if (details.previousPrice && details.currentPrice) {
        const isRising = details.currentPrice > details.previousPrice;
        const pct = details.percentDrop ?? details.percentRise;
        return (
            <div className="flex items-center gap-2 mt-2">
                <span className="text-sm font-medium text-gray-500 line-through">£{details.previousPrice.toFixed(2)}</span>
                <span className="text-gray-400">→</span>
                <span className={`text-base font-bold ${isRising ? 'text-amber-600' : 'text-green-600'}`}>
                    £{details.currentPrice.toFixed(2)}
                </span>
                {pct != null && (
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${isRising ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                        {isRising ? '+' : '-'}{Math.abs(pct).toFixed(1)}%
                    </span>
                )}
            </div>
        );
    }
    if (details.lowestPrice && details.currentPrice) {
        return (
            <div className="flex items-center gap-2 mt-2">
                <span className="text-sm text-gray-500">Current:</span>
                <span className="text-base font-bold text-emerald-600">£{details.currentPrice.toFixed(2)}</span>
                <span className="text-xs text-gray-400">
                    (lowest in {details.days ?? '?'} days)
                </span>
            </div>
        );
    }
    if (details.voucherCode) {
        return (
            <div className="mt-2 flex items-center gap-2">
                <span className="text-sm text-gray-500">Code:</span>
                <code className="bg-yellow-50 border border-yellow-200 text-yellow-900 text-sm font-mono px-2 py-0.5 rounded">
                    {details.voucherCode}
                </code>
            </div>
        );
    }
    return null;
}

function SnoozePicker({ onSnooze, isLoading }: { onSnooze: (days: number) => void; isLoading: boolean }) {
    const [open, setOpen] = useState(false);
    const options = [1, 3, 7, 14, 30];
    return (
        <div className="relative">
            <button
                onClick={() => setOpen((o) => !o)}
                disabled={isLoading}
                className="flex items-center gap-1 text-xs px-3 py-1.5 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-md font-medium transition-colors disabled:opacity-50"
            >
                😴 Snooze
            </button>
            {open && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                    <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 w-36">
                        {options.map((d) => (
                            <button
                                key={d}
                                onClick={() => { onSnooze(d); setOpen(false); }}
                                className="w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                            >
                                {d === 1 ? '1 day' : `${d} days`}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

function AlertDrawer({ alert, onClose, onDismiss, onSnooze }: {
    alert: Alert;
    onClose: () => void;
    onDismiss: (id: string) => void;
    onSnooze: (fingerprintId: string, days: number) => void;
}) {
    const router = useRouter();
    const meta = INSIGHT_META[alert.insight?.type] ?? { icon: '📢', label: 'Alert', colour: 'bg-gray-100 text-gray-700', border: 'border-l-gray-400' };
    const fingerprint = alert.insight?.fingerprint;
    const isDismissed = alert.status === 'DISMISSED';
    const isSnoozed = fingerprint?.snoozedUntil && new Date(fingerprint.snoozedUntil) > new Date();

    return (
        <>
            <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
            <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
                {/* Header */}
                <div className={`flex items-start justify-between p-6 border-b border-l-4 ${meta.border}`}>
                    <div className="flex-1 pr-4">
                        <div className="flex items-center gap-2 flex-wrap mb-2">
                            <span className="text-xl">{meta.icon}</span>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${meta.colour}`}>
                                {meta.label}
                            </span>
                            {fingerprint?.provider && (
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${PROVIDER_COLOURS[fingerprint.provider.code] ?? 'bg-gray-100 text-gray-700'}`}>
                                    {fingerprint.provider.name}
                                </span>
                            )}
                            {isDismissed && (
                                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Dismissed</span>
                            )}
                        </div>
                        <p className="text-base font-semibold text-gray-900 leading-snug">{alert.insight?.summary}</p>
                        <PriceChange details={alert.insight?.details ?? {}} />
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none mt-1 flex-shrink-0">×</button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {/* Watcher */}
                    {fingerprint?.profile && (
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Watcher</p>
                            <p className="text-sm text-gray-800 font-medium">{fingerprint.profile.name}</p>
                            {fingerprint.park && (
                                <p className="text-sm text-gray-500 mt-0.5">
                                    {fingerprint.park.name}{fingerprint.park.region ? ` · ${fingerprint.park.region}` : ''}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Details */}
                    {alert.insight?.details && Object.keys(alert.insight.details).length > 0 && (
                        <div>
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Full Details</p>
                            <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                                {Object.entries(alert.insight.details).map(([k, v]) => {
                                    if (v == null) return null;
                                    const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
                                    const display = typeof v === 'number' && k.toLowerCase().includes('price')
                                        ? `£${Number(v).toFixed(2)}`
                                        : typeof v === 'number' && k.toLowerCase().includes('percent')
                                        ? `${Number(v).toFixed(1)}%`
                                        : String(v);
                                    return (
                                        <div key={k} className="flex justify-between text-sm">
                                            <span className="text-gray-500">{label}</span>
                                            <span className="text-gray-800 font-medium">{display}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Snooze status */}
                    {isSnoozed && (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                            Alerts for this watcher are snoozed until{' '}
                            <strong>{new Date(fingerprint!.snoozedUntil!).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>.
                        </div>
                    )}

                    {/* Timestamps */}
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Timeline</p>
                        <div className="text-sm text-gray-600 space-y-0.5">
                            <p>Detected: {new Date(alert.createdAt).toLocaleString('en-GB')}</p>
                            {alert.sentAt && <p>Emailed: {new Date(alert.sentAt).toLocaleString('en-GB')}</p>}
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="border-t p-6 space-y-3 bg-gray-50">
                    {fingerprint?.profile?.id && (
                        <button
                            onClick={() => { router.push(`/dashboard/profile/${fingerprint.profile.id}`); onClose(); }}
                            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                            View watcher & price history
                        </button>
                    )}
                    {fingerprint?.provider?.baseUrl && (
                        <a
                            href={fingerprint.provider.baseUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                        >
                            Visit {fingerprint.provider.name} ↗
                        </a>
                    )}
                    {fingerprint?.id && !isDismissed && (
                        <div className="flex gap-2">
                            <SnoozePicker
                                onSnooze={(days) => onSnooze(fingerprint.id, days)}
                                isLoading={false}
                            />
                            <button
                                onClick={() => { onDismiss(alert.id); onClose(); }}
                                className="flex-1 text-xs px-3 py-1.5 border border-gray-300 text-gray-600 hover:bg-gray-50 rounded-md font-medium transition-colors"
                            >
                                Dismiss alert
                            </button>
                        </div>
                    )}
                    {fingerprint?.provider && (
                        <a
                            href={`/dashboard/deals?provider=${fingerprint.provider.code}`}
                            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors"
                        >
                            Browse {fingerprint.provider.name} deals
                        </a>
                    )}
                </div>
            </div>
        </>
    );
}

export default function AlertsPage() {
    const router = useRouter();
    const [unreadOnly, setUnreadOnly] = useState(false);
    const [typeFilter, setTypeFilter] = useState('');
    const [page, setPage] = useState(1);
    const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
    const queryClient = useQueryClient();
    const limit = 20;

    const { data, isLoading } = useQuery({
        queryKey: ['alerts-history', unreadOnly, page],
        queryFn: async () => {
            const params = new URLSearchParams({
                limit: String(limit),
                page: String(page),
                unreadOnly: String(unreadOnly),
            });
            const { data } = await api.get(`/alerts/recent?${params}`);
            return data;
        },
    });

    const dismissMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.patch(`/alerts/${id}/dismiss`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['alerts-history'] });
            // Update selected alert state if drawer is open
            setSelectedAlert((prev) => prev ? { ...prev, status: 'DISMISSED' } : null);
        },
    });

    const dismissAllMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            await Promise.all(ids.map((id) => api.patch(`/alerts/${id}/dismiss`)));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['alerts-history'] });
        },
    });

    const snoozeMutation = useMutation({
        mutationFn: async ({ fingerprintId, days }: { fingerprintId: string; days: number }) => {
            await api.post('/snooze', { fingerprintId, days });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['alerts-history'] });
        },
    });

    const alerts: Alert[] = data?.alerts || [];
    const totalPages: number = data?.pages || 1;
    const totalUnread: number = data?.totalUnread || 0;

    const visibleAlerts = typeFilter ? alerts.filter((a) => a.insight?.type === typeFilter) : alerts;
    const undismissedAlerts = visibleAlerts.filter((a) => a.status !== 'DISMISSED');

    return (
        <div className="px-4 py-6 sm:px-0">
            {/* Page header */}
            <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Alert History</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Price alerts across all your watchers.
                        {totalUnread > 0 && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {totalUnread} unread
                            </span>
                        )}
                    </p>
                </div>
                {undismissedAlerts.length > 1 && (
                    <button
                        onClick={() => dismissAllMutation.mutate(undismissedAlerts.map((a) => a.id))}
                        disabled={dismissAllMutation.isPending}
                        className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 px-3 py-1.5 rounded-md hover:bg-gray-50 disabled:opacity-50"
                    >
                        Dismiss all on page
                    </button>
                )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-4 mb-5">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={unreadOnly}
                        onChange={(e) => { setUnreadOnly(e.target.checked); setPage(1); }}
                        className="rounded text-primary-600"
                    />
                    Unread only
                </label>

                <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700">Type:</label>
                    <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="rounded-md border-gray-300 shadow-sm text-sm focus:border-primary-500 focus:ring-primary-500"
                    >
                        <option value="">All types</option>
                        {Object.entries(INSIGHT_META).map(([key, { icon, label }]) => (
                            <option key={key} value={key}>{icon} {label}</option>
                        ))}
                    </select>
                </div>

                {data?.total !== undefined && (
                    <span className="text-sm text-gray-500 ml-auto">
                        {visibleAlerts.length} alert{visibleAlerts.length !== 1 ? 's' : ''}
                        {typeFilter ? ' (filtered)' : ''}
                    </span>
                )}
            </div>

            {isLoading && (
                <div className="flex items-center justify-center min-h-[300px]">
                    <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full" />
                </div>
            )}

            {!isLoading && visibleAlerts.length === 0 && (
                <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="text-4xl mb-3">🔔</div>
                    <h3 className="text-sm font-semibold text-gray-900">No alerts yet</h3>
                    <p className="mt-1 text-sm text-gray-500">Alerts appear here when deals are detected for your watchers.</p>
                    <button
                        onClick={() => router.push('/dashboard')}
                        className="mt-4 text-sm text-primary-600 hover:underline"
                    >
                        Set up a watcher →
                    </button>
                </div>
            )}

            <div className="space-y-2">
                {visibleAlerts.map((alert) => {
                    const meta = INSIGHT_META[alert.insight?.type] ?? { icon: '📢', label: 'Alert', colour: 'bg-gray-100 text-gray-700', border: 'border-l-gray-400' };
                    const isDismissed = alert.status === 'DISMISSED';
                    const fingerprint = alert.insight?.fingerprint;
                    const isSnoozed = fingerprint?.snoozedUntil && new Date(fingerprint.snoozedUntil) > new Date();

                    return (
                        <div
                            key={alert.id}
                            onClick={() => setSelectedAlert(alert)}
                            className={`flex items-start gap-4 bg-white border border-l-4 ${meta.border} rounded-lg px-4 py-3 cursor-pointer transition-all hover:shadow-md hover:border-r-primary-200 ${
                                isDismissed ? 'opacity-50' : 'shadow-sm'
                            }`}
                        >
                            <span className="text-xl mt-0.5 flex-shrink-0">{meta.icon}</span>

                            <div className="flex-1 min-w-0">
                                {/* Row 1: type + watcher + status */}
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${meta.colour}`}>
                                        {meta.label}
                                    </span>
                                    {fingerprint?.profile?.name && (
                                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded truncate max-w-[200px]">
                                            {fingerprint.profile.name}
                                        </span>
                                    )}
                                    {fingerprint?.provider && (
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PROVIDER_COLOURS[fingerprint.provider.code] ?? 'bg-gray-100 text-gray-700'}`}>
                                            {fingerprint.provider.name}
                                        </span>
                                    )}
                                    {isDismissed && (
                                        <span className="text-xs text-gray-400">dismissed</span>
                                    )}
                                    {isSnoozed && (
                                        <span className="text-xs text-amber-600">😴 snoozed</span>
                                    )}
                                </div>

                                {/* Row 2: summary */}
                                <p className="text-sm text-gray-800 mt-0.5 leading-snug">{alert.insight?.summary}</p>

                                {/* Row 3: price change inline */}
                                {alert.insight?.details?.previousPrice != null && alert.insight?.details?.currentPrice != null && (
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        Was £{Number(alert.insight.details.previousPrice).toFixed(2)} → Now £{Number(alert.insight.details.currentPrice).toFixed(2)}
                                    </p>
                                )}
                            </div>

                            {/* Right side: time + quick actions */}
                            <div className="flex flex-col items-end gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                                <span className="text-xs text-gray-400">{timeAgo(alert.createdAt)}</span>
                                <div className="flex items-center gap-1.5">
                                    {fingerprint?.profile?.id && (
                                        <button
                                            onClick={() => router.push(`/dashboard/profile/${fingerprint.profile.id}`)}
                                            className="text-xs px-2 py-1 border border-primary-300 text-primary-600 hover:bg-primary-50 rounded font-medium transition-colors"
                                            title="View watcher"
                                        >
                                            View
                                        </button>
                                    )}
                                    {!isDismissed && fingerprint?.id && (
                                        <SnoozePicker
                                            onSnooze={(days) => snoozeMutation.mutate({ fingerprintId: fingerprint.id, days })}
                                            isLoading={snoozeMutation.isPending}
                                        />
                                    )}
                                    {!isDismissed && (
                                        <button
                                            onClick={() => dismissMutation.mutate(alert.id)}
                                            disabled={dismissMutation.isPending}
                                            className="text-gray-400 hover:text-gray-600 text-lg leading-none px-1"
                                            title="Dismiss"
                                        >
                                            ✕
                                        </button>
                                    )}
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

            {/* Alert detail drawer */}
            {selectedAlert && (
                <AlertDrawer
                    alert={selectedAlert}
                    onClose={() => setSelectedAlert(null)}
                    onDismiss={(id) => dismissMutation.mutate(id)}
                    onSnooze={(fingerprintId, days) => snoozeMutation.mutate({ fingerprintId, days })}
                />
            )}
        </div>
    );
}
