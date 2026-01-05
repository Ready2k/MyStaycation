'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import api from '@/services/api';
import { ConfirmationModal } from '@/components/ConfirmationModal';

interface Watcher {
    id: string;
    name: string;
    target: string;
    user: { id: string; email: string };
    fingerprintCount: number;
    createdAt: string;
}

export default function WatchersTab() {
    const queryClient = useQueryClient();
    const [watcherToDelete, setWatcherToDelete] = useState<Watcher | null>(null);

    const { data: watchers, isLoading } = useQuery({
        queryKey: ['admin', 'watchers'],
        queryFn: async () => {
            const { data } = await api.get<{ watchers: Watcher[] }>('/admin/watchers');
            return data.watchers;
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/admin/watchers/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'watchers'] });
            setWatcherToDelete(null);
        },
        onError: (error: any) => {
            alert(`Failed to delete watcher: ${error.response?.data?.error || error.message}`);
        }
    });

    if (isLoading) return <div>Loading watchers...</div>;

    return (
        <div className="space-y-6">
            <ConfirmationModal
                isOpen={!!watcherToDelete}
                onClose={() => setWatcherToDelete(null)}
                onConfirm={() => watcherToDelete && deleteMutation.mutate(watcherToDelete.id)}
                title="Force Delete Watcher"
                message={`Are you sure you want to permanently delete the watcher "${watcherToDelete?.name}"? This will delete all associated fingerprints and observations.`}
                confirmLabel={deleteMutation.isPending ? 'Deleting...' : 'Force Delete'}
                isDestructive={true}
            />

            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Watcher Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Target</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Owner</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fingerprints</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {watchers?.map((watcher) => (
                            <tr key={watcher.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {watcher.name}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {watcher.target}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {watcher.user?.email || 'Unknown'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {watcher.fingerprintCount}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setWatcherToDelete(watcher);
                                        }}
                                        className="text-red-600 hover:text-red-900"
                                    >
                                        Force Delete
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
