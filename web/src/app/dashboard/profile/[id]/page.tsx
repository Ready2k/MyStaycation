'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';
import { PriceChart } from '@/components/PriceChart';
import { format } from 'date-fns';
import { useState } from 'react';

export default function ProfileDetailPage() {
    const params = useParams();
    const router = useRouter();
    const profileId = params.id as string;
    const [days, setDays] = useState(90);

    // Fetch profile details
    const { data: profile, isLoading: profileLoading } = useQuery({
        queryKey: ['profile', profileId],
        queryFn: async () => {
            const { data } = await api.get(`/profiles/${profileId}`);
            return data;
        },
    });

    // Fetch fingerprints for this profile
    const { data: fingerprints } = useQuery({
        queryKey: ['fingerprints', profileId],
        queryFn: async () => {
            const { data } = await api.get(`/search/fingerprints?profileId=${profileId}`);
            return data.fingerprints || [];
        },
        enabled: !!profileId,
    });

    // Use first fingerprint for now (most profiles have one)
    const fingerprintId = fingerprints?.[0]?.id;

    // Fetch price history
    const { data: priceHistory, isLoading: historyLoading } = useQuery({
        queryKey: ['price-history', fingerprintId, days],
        queryFn: async () => {
            const { data } = await api.get(`/insights/${fingerprintId}/price-history?days=${days}`);
            return data;
        },
        enabled: !!fingerprintId,
    });

    // Fetch recent insights for this profile
    const { data: insights } = useQuery({
        queryKey: ['insights', profileId],
        queryFn: async () => {
            const { data } = await api.get(`/insights/recent?limit=5`);
            // Filter to this profile's fingerprints
            const filtered = data.insights.filter((insight: any) =>
                insight.fingerprint?.profile?.id === profileId
            );
            return filtered;
        },
        enabled: !!profileId,
    });

    if (profileLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto mb-3"></div>
                    <p className="text-sm text-gray-600">Loading profile...</p>
                </div>
            </div>
        );
    }

    if (!profile) {
        return (
            <div className="text-center py-12">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Profile Not Found</h3>
                <button
                    onClick={() => router.push('/dashboard')}
                    className="text-primary-600 hover:text-primary-700"
                >
                    ← Back to Dashboard
                </button>
            </div>
        );
    }

    const getInsightIcon = (type: string) => {
        switch (type) {
            case 'PRICE_DROP_PERCENT': return '💰';
            case 'LOWEST_IN_X_DAYS': return '🎯';
            case 'RISK_RISING': return '⚠️';
            default: return '📢';
        }
    };

    return (
        <div className="px-4 py-6 sm:px-0">
            {/* Header with Back Button */}
            <div className="mb-6">
                <button
                    onClick={() => router.push('/dashboard')}
                    className="text-sm text-gray-600 hover:text-gray-900 mb-3 flex items-center gap-1"
                >
                    ← Back to Watchers
                </button>
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{profile.name}</h1>
                        <p className="mt-1 text-sm text-gray-500">
                            {profile.partySizeAdults} Adults{profile.partySizeChildren > 0 && `, ${profile.partySizeChildren} Children`}
                            {profile.pets && ' 🐾'}
                        </p>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${profile.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                        {profile.enabled ? 'Active' : 'Paused'}
                    </span>
                </div>
            </div>

            {/* Profile Summary Card */}
            <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                <h2 className="text-lg font-semibold mb-4">Watcher Details</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {(profile.dateStart || profile.dateEnd) && (
                        <div>
                            <div className="text-gray-500 mb-1">Dates</div>
                            <div className="font-medium">
                                {profile.dateStart ? format(new Date(profile.dateStart), 'MMM d') : 'Any'}
                                {' - '}
                                {profile.dateEnd ? format(new Date(profile.dateEnd), 'MMM d, yyyy') : 'Any'}
                            </div>
                        </div>
                    )}
                    <div>
                        <div className="text-gray-500 mb-1">Duration</div>
                        <div className="font-medium">{profile.durationNightsMin} - {profile.durationNightsMax} nights</div>
                    </div>
                    {profile.budgetCeilingGbp && (
                        <div>
                            <div className="text-gray-500 mb-1">Max Budget</div>
                            <div className="font-medium">£{profile.budgetCeilingGbp}</div>
                        </div>
                    )}
                    {profile.region && (
                        <div>
                            <div className="text-gray-500 mb-1">Region</div>
                            <div className="font-medium">{profile.region}</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Price History Chart */}
            <div className="mb-6">
                <PriceChart
                    series={priceHistory?.series || []}
                    isLoading={historyLoading}
                />
            </div>

            {/* Recent Insights */}
            {insights && insights.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold mb-4">Recent Alerts</h2>
                    <div className="space-y-3">
                        {insights.map((insight: any) => (
                            <div
                                key={insight.id}
                                className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                            >
                                <span className="text-2xl">{getInsightIcon(insight.type)}</span>
                                <div className="flex-1">
                                    <p className="font-medium text-gray-900">{insight.summary}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {format(new Date(insight.createdAt), 'MMM d, yyyy HH:mm')}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
