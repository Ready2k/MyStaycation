'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';

interface Alert {
    id: string;
    status: 'PENDING' | 'SENT' | 'DISMISSED';
    createdAt: string;
    insight: {
        type: string;
        summary: string;
        details: any;
        fingerprint?: {
            id: string;
            profile: { name: string };
        };
    };
}

const INSIGHT_META: Record<string, { icon: string; label: string }> = {
    PRICE_DROP_PERCENT: { icon: '💰', label: 'Price drop' },
    LOWEST_IN_X_DAYS: { icon: '🎯', label: 'Lowest price' },
    RISK_RISING: { icon: '⚠️', label: 'Price rising' },
    NEW_CAMPAIGN_DETECTED: { icon: '🎉', label: 'New campaign' },
    VOUCHER_SPOTTED: { icon: '🎫', label: 'Voucher spotted' },
};

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}

export default function AlertsPage() {
    const [unreadOnly, setUnreadOnly] = useState(false);
    const [page, setPage] = useState(1);
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
        },
    });

    const dismissAllMutation = useMutation({
        mutationFn: async (ids: string[]) => {
            await Promise.all(ids.map(id => api.patch(`/alerts/${id}/dismiss`)));
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['alerts-history'] });
        },
    });

    const alerts: Alert[] = data?.alerts || [];
    const totalPages: number = data?.pages || 1;
    const totalUnread: number = data?.totalUnread || 0;
    const undismissedAlerts = alerts.filter(a => a.status !== 'DISMISSED');

    return (
        <div className="px-4 py-6 sm:px-0">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Alert History</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        All price alerts across your watchers.
                        {totalUnread > 0 && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {totalUnread} unread
                            </span>
                        )}
                    </p>
                </div>
                {undismissedAlerts.length > 1 && (
                    <button
                        onClick={() => dismissAllMutation.mutate(undismissedAlerts.map(a => a.id))}
                        disabled={dismissAllMutation.isPending}
                        className="text-sm text-gray-600 hover:text-gray-900 border border-gray-300 px-3 py-1.5 rounded-md hover:bg-gray-50 disabled:opacity-50"
                    >
                        Dismiss all on page
                    </button>
                )}
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 mb-4">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={unreadOnly}
                        onChange={e => { setUnreadOnly(e.target.checked); setPage(1); }}
                        className="rounded text-primary-600"
                    />
                    Show unread only
                </label>
            </div>

            {isLoading && (
                <div className="text-center py-12 text-gray-500">Loading alerts...</div>
            )}

            {!isLoading && alerts.length === 0 && (
                <div className="text-center py-12 bg-white rounded-lg shadow-sm border border-gray-200">
                    <div className="text-4xl mb-3">🔔</div>
                    <h3 className="text-sm font-semibold text-gray-900">No alerts yet</h3>
                    <p className="mt-1 text-sm text-gray-500">Alerts will appear here when deals are detected.</p>
                </div>
            )}

            <div className="space-y-2">
                {alerts.map(alert => {
                    const meta = INSIGHT_META[alert.insight?.type] || { icon: '📢', label: 'Alert' };
                    const isDismissed = alert.status === 'DISMISSED';

                    return (
                        <div
                            key={alert.id}
                            className={`flex items-start gap-4 bg-white border rounded-lg px-4 py-3 ${
                                isDismissed ? 'opacity-50' : 'shadow-sm'
                            }`}
                        >
                            <span className="text-xl mt-0.5">{meta.icon}</span>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                        {meta.label}
                                    </span>
                                    {alert.insight?.fingerprint?.profile?.name && (
                                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                            {alert.insight.fingerprint.profile.name}
                                        </span>
                                    )}
                                    {isDismissed && (
                                        <span className="text-xs text-gray-400">dismissed</span>
                                    )}
                                </div>
                                <p className="text-sm text-gray-800 mt-0.5">
                                    {alert.insight?.summary}
                                </p>
                                {alert.insight?.details?.previousPrice && (
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        Was £{alert.insight.details.previousPrice} → Now £{alert.insight.details.currentPrice}
                                    </p>
                                )}
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                <span className="text-xs text-gray-400">{timeAgo(alert.createdAt)}</span>
                                {!isDismissed && (
                                    <button
                                        onClick={() => dismissMutation.mutate(alert.id)}
                                        disabled={dismissMutation.isPending}
                                        className="text-gray-400 hover:text-gray-600 text-sm"
                                        title="Dismiss"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })}
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
