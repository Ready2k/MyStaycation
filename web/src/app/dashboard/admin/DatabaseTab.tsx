'use client';

import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

export default function DatabaseTab() {
    const { data: stats, isLoading } = useQuery({
        queryKey: ['admin', 'stats', 'database'],
        queryFn: async () => {
            const { data } = await api.get('/admin/stats/database');
            return data;
        }
    });

    if (isLoading) return <div>Loading database stats...</div>;

    const statItems = [
        { label: 'Registered Users', value: stats.users, color: 'bg-blue-500' },
        { label: 'Holiday Profiles', value: stats.profiles, color: 'bg-green-500' },
        { label: 'Search Fingerprints', value: stats.fingerprints, color: 'bg-purple-500' },
        { label: 'Price Observations', value: stats.observations, color: 'bg-amber-500' },
        { label: 'Fetch Runs', value: stats.fetchRuns, color: 'bg-indigo-500' },
        { label: 'System Logs', value: stats.logs, color: 'bg-gray-500' },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {statItems.map((item) => (
                <div key={item.label} className="bg-white overflow-hidden shadow rounded-lg">
                    <div className="p-5">
                        <div className="flex items-center">
                            <div className={`flex-shrink-0 rounded-md p-3 ${item.color}`}>
                                {/* Simple Icon placeholder */}
                                <div className="h-6 w-6 text-white text-center font-bold">#</div>
                            </div>
                            <div className="ml-5 w-0 flex-1">
                                <dl>
                                    <dt className="text-sm font-medium text-gray-500 truncate">{item.label}</dt>
                                    <dd>
                                        <div className="text-lg font-medium text-gray-900">{item.value?.toLocaleString()}</div>
                                    </dd>
                                </dl>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
