'use client';

interface Insight {
    id: string;
    type: string;
    payload?: Record<string, any>;
    createdAt: string;
}

interface BookingRecommendationProps {
    insights: Insight[] | undefined;
}

export function BookingRecommendation({ insights }: BookingRecommendationProps) {
    if (!insights || insights.length === 0) {
        return (
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <span className="text-2xl">📊</span>
                <div>
                    <p className="font-medium text-gray-700">Monitoring — no strong signal yet</p>
                    <p className="text-sm text-gray-500">Watching for price changes. We'll surface a recommendation once there's enough data.</p>
                </div>
            </div>
        );
    }

    // Find the most recent actionable insight
    const actionable = insights.find(i => i.type === 'RISK_RISING' || i.type === 'LOWEST_IN_X_DAYS');

    if (!actionable) {
        return (
            <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <span className="text-2xl">📊</span>
                <div>
                    <p className="font-medium text-gray-700">Monitoring — no strong signal yet</p>
                    <p className="text-sm text-gray-500">Prices are stable. No urgent action needed right now.</p>
                </div>
            </div>
        );
    }

    if (actionable.type === 'RISK_RISING') {
        return (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-300 rounded-lg p-4 mb-6">
                <span className="text-2xl">⚠️</span>
                <div>
                    <p className="font-medium text-amber-800">Price rising — consider booking soon</p>
                    <p className="text-sm text-amber-700">Prices have been trending upward. Waiting may cost more.</p>
                </div>
            </div>
        );
    }

    // LOWEST_IN_X_DAYS
    const days = actionable.payload?.days as number | undefined;
    return (
        <div className="flex items-center gap-3 bg-green-50 border border-green-300 rounded-lg p-4 mb-6">
            <span className="text-2xl">✅</span>
            <div>
                <p className="font-medium text-green-800">
                    {days ? `Lowest price in ${days} days` : 'Near-lowest price seen'} — good time to book
                </p>
                <p className="text-sm text-green-700">This is one of the best prices we've recorded for these dates.</p>
            </div>
        </div>
    );
}
