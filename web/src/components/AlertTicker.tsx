'use client';

import { useEffect, useState, useRef } from 'react';
import api from '../services/api';

interface Alert {
    id: string;
    insight: {
        type: string;
        summary: string;
        details: any;
        fingerprint?: {
            id: string;
            profile: {
                name: string;
            };
        };
    };
    profile: {
        name: string;
    };
    createdAt: string;
    status: string;
}

const INSIGHT_LABELS: Record<string, { icon: string; title: string }> = {
    PRICE_DROP_PERCENT: {
        icon: '💰',
        title: 'Price drop — the price has fallen since the last check. A good time to book.',
    },
    LOWEST_IN_X_DAYS: {
        icon: '🎯',
        title: 'Lowest price seen in weeks — this is the cheapest this stay has been recently.',
    },
    RISK_RISING: {
        icon: '⚠️',
        title: 'Price rising — the trend is upward. Consider booking soon before it climbs further.',
    },
    NEW_CAMPAIGN_DETECTED: {
        icon: '🎉',
        title: 'New promotion — the provider has launched a new sale or campaign.',
    },
    VOUCHER_SPOTTED: {
        icon: '🎫',
        title: 'Voucher spotted — a discount code has been found for this provider. Check the Deals page.',
    },
};

const SNOOZE_OPTIONS = [
    { label: '1 day', days: 1 },
    { label: '3 days', days: 3 },
    { label: '7 days', days: 7 },
    { label: '30 days', days: 30 },
];

function getAlertColour(type: string): string {
    switch (type) {
        case 'PRICE_DROP_PERCENT': return 'bg-green-50 border-green-200';
        case 'LOWEST_IN_X_DAYS': return 'bg-blue-50 border-blue-200';
        case 'RISK_RISING': return 'bg-yellow-50 border-yellow-200';
        case 'NEW_CAMPAIGN_DETECTED': return 'bg-purple-50 border-purple-200';
        default: return 'bg-gray-50 border-gray-200';
    }
}

function SnoozeMenu({
    fingerprintId,
    onSnooze,
}: {
    fingerprintId: string;
    onSnooze: (days: number) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(o => !o)}
                className="text-gray-400 hover:text-gray-600 ml-2 text-sm"
                title="Snooze this alert"
            >
                🔕
            </button>
            {open && (
                <div className="absolute right-0 top-6 z-10 bg-white border border-gray-200 rounded-md shadow-lg py-1 min-w-[120px]">
                    <p className="px-3 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wide">Snooze for</p>
                    {SNOOZE_OPTIONS.map(({ label, days }) => (
                        <button
                            key={days}
                            onClick={() => { onSnooze(days); setOpen(false); }}
                            className="block w-full text-left px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                        >
                            {label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

export function AlertTicker() {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [totalUnread, setTotalUnread] = useState(0);
    const [expanded, setExpanded] = useState(false);
    const [loading, setLoading] = useState(true);

    const fetchAlerts = async () => {
        try {
            const { data } = await api.get('/alerts/recent?limit=5&unreadOnly=true');
            setAlerts(data.alerts || []);
            setTotalUnread(data.totalUnread || 0);
        } catch (error) {
            console.error('Failed to fetch alerts:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAlerts();
        const interval = setInterval(fetchAlerts, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const dismissAlert = async (id: string) => {
        try {
            await api.patch(`/alerts/${id}/dismiss`);
            setAlerts(prev => prev.filter(a => a.id !== id));
            setTotalUnread(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Failed to dismiss alert:', error);
        }
    };

    const snoozeAlert = async (alert: Alert, days: number) => {
        const fingerprintId = alert.insight?.fingerprint?.id;
        if (!fingerprintId) return;
        try {
            await api.post('/snooze', { fingerprintId, days });
            // Dismiss the alert visually (snooze silences future alerts, not the existing one)
            await dismissAlert(alert.id);
        } catch (error) {
            console.error('Failed to snooze alert:', error);
        }
    };

    if (loading) return null;
    if (totalUnread === 0) return null;

    return (
        <div className="mb-6">
            {/* Summary Banner */}
            <div
                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-3 rounded-lg shadow-md cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">🔔</span>
                        <div>
                            <h3 className="font-semibold">
                                {totalUnread} New {totalUnread === 1 ? 'Alert' : 'Alerts'}
                            </h3>
                            <p className="text-sm text-blue-100">
                                {alerts.length > 0 && alerts[0].insight?.summary}
                            </p>
                        </div>
                    </div>
                    <button className="text-white hover:text-blue-100">
                        {expanded ? '▼' : '▶'}
                    </button>
                </div>
            </div>

            {/* Expanded Alert List */}
            {expanded && (
                <div className="mt-2 space-y-2">
                    {alerts.filter(alert => alert.insight).map((alert) => {
                        const meta = INSIGHT_LABELS[alert.insight.type] || { icon: '📢', title: 'Alert' };
                        return (
                            <div
                                key={alert.id}
                                className={`border rounded-lg p-4 ${getAlertColour(alert.insight.type)}`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-3 flex-1">
                                        <span
                                            className="text-2xl cursor-help"
                                            title={meta.title}
                                            aria-label={meta.title}
                                        >
                                            {meta.icon}
                                        </span>
                                        <div className="flex-1">
                                            <h4 className="font-semibold text-gray-900">
                                                {alert.insight.fingerprint?.profile?.name || 'Your Holiday'}
                                            </h4>
                                            <p className="text-gray-700 mt-1">
                                                {alert.insight.summary}
                                            </p>
                                            {alert.insight.details && (
                                                <div className="mt-2 text-sm text-gray-600">
                                                    {alert.insight.type === 'PRICE_DROP_PERCENT' && (
                                                        <span>
                                                            Was £{alert.insight.details.previousPrice} →{' '}
                                                            Now £{alert.insight.details.currentPrice}
                                                        </span>
                                                    )}
                                                    {alert.insight.type === 'LOWEST_IN_X_DAYS' && (
                                                        <span>
                                                            £{alert.insight.details.currentPrice} for{' '}
                                                            {alert.insight.details.stayNights} nights
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                            <p className="text-xs text-gray-500 mt-2">
                                                {new Date(alert.createdAt).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center ml-4">
                                        {alert.insight.fingerprint?.id && (
                                            <SnoozeMenu
                                                fingerprintId={alert.insight.fingerprint.id}
                                                onSnooze={(days) => snoozeAlert(alert, days)}
                                            />
                                        )}
                                        <button
                                            onClick={() => dismissAlert(alert.id)}
                                            className="text-gray-400 hover:text-gray-600 ml-2"
                                            title="Dismiss"
                                        >
                                            ✕
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
