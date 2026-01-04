'use client';

import { useEffect, useState } from 'react';

interface Alert {
    id: string;
    insight: {
        type: string;
        summary: string;
        details: any;
    };
    profile: {
        name: string;
    };
    createdAt: string;
    status: string;
}

export function AlertTicker() {
    const [alerts, setAlerts] = useState<Alert[]>([]);
    const [totalUnread, setTotalUnread] = useState(0);
    const [expanded, setExpanded] = useState(false);
    const [loading, setLoading] = useState(true);

    const fetchAlerts = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('http://localhost:4000/api/alerts/recent?limit=5&unreadOnly=true', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            const data = await response.json();
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
        // Refresh every 5 minutes
        const interval = setInterval(fetchAlerts, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, []);

    const dismissAlert = async (id: string) => {
        try {
            const token = localStorage.getItem('token');
            await fetch(`http://localhost:4000/api/alerts/${id}/dismiss`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });
            setAlerts(alerts.filter(a => a.id !== id));
            setTotalUnread(Math.max(0, totalUnread - 1));
        } catch (error) {
            console.error('Failed to dismiss alert:', error);
        }
    };

    const getAlertIcon = (type: string) => {
        switch (type) {
            case 'PRICE_DROP_PERCENT': return '💰';
            case 'LOWEST_IN_X_DAYS': return '🎯';
            case 'RISK_RISING': return '⚠️';
            case 'NEW_CAMPAIGN_DETECTED': return '🎉';
            case 'VOUCHER_SPOTTED': return '🎫';
            default: return '📢';
        }
    };

    const getAlertColor = (type: string) => {
        switch (type) {
            case 'PRICE_DROP_PERCENT': return 'bg-green-50 border-green-200';
            case 'LOWEST_IN_X_DAYS': return 'bg-blue-50 border-blue-200';
            case 'RISK_RISING': return 'bg-yellow-50 border-yellow-200';
            case 'NEW_CAMPAIGN_DETECTED': return 'bg-purple-50 border-purple-200';
            default: return 'bg-gray-50 border-gray-200';
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
                                {alerts.length > 0 && alerts[0].insight.summary}
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
                    {alerts.map((alert) => (
                        <div
                            key={alert.id}
                            className={`border rounded-lg p-4 ${getAlertColor(alert.insight.type)}`}
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-start gap-3 flex-1">
                                    <span className="text-2xl">{getAlertIcon(alert.insight.type)}</span>
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
                                                        Was £{alert.insight.details.previousPrice} →
                                                        Now £{alert.insight.details.currentPrice}
                                                    </span>
                                                )}
                                                {alert.insight.type === 'LOWEST_IN_X_DAYS' && (
                                                    <span>
                                                        £{alert.insight.details.currentPrice} for {alert.insight.details.stayNights} nights
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        <p className="text-xs text-gray-500 mt-2">
                                            {new Date(alert.createdAt).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => dismissAlert(alert.id)}
                                    className="text-gray-400 hover:text-gray-600 ml-4"
                                    title="Dismiss"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
