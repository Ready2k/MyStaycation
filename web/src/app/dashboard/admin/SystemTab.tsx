'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';

export default function SystemTab() {
    const queryClient = useQueryClient();

    const { data: performance, isLoading: loadingPerf } = useQuery({
        queryKey: ['admin', 'performance'],
        queryFn: async () => {
            const { data } = await api.get('/admin/performance');
            return data.queues;
        }
    });

    const { data: logs, isLoading: loadingLogs } = useQuery({
        queryKey: ['admin', 'logs'],
        queryFn: async () => {
            const { data } = await api.get('/admin/logs');
            return data.logs;
        }
    });

    const clearLogsMutation = useMutation({
        mutationFn: async () => {
            await api.delete('/admin/logs');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'logs'] });
        }
    });

    if (loadingPerf || loadingLogs) return <div>Loading system data...</div>;

    return (
        <div className="space-y-8">
            {/* Performance / Queues */}
            <div>
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Job Queues (BullMQ)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {performance?.map((queue: any) => (
                        <div key={queue.name} className="bg-white border rounded-lg p-4 shadow-sm">
                            <h4 className="font-bold text-gray-700 mb-2">{queue.name} Queue</h4>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div className="text-gray-500">Active:</div>
                                <div className="text-right font-mono text-blue-600">{queue.active}</div>
                                <div className="text-gray-500">Completed:</div>
                                <div className="text-right font-mono text-green-600">{queue.completed}</div>
                                <div className="text-gray-500">Failed:</div>
                                <div className="text-right font-mono text-red-600">{queue.failed}</div>
                                <div className="text-gray-500">Delayed:</div>
                                <div className="text-right font-mono text-amber-600">{queue.delayed}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Logs */}
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">System Logs</h3>
                    <button
                        onClick={() => {
                            if (confirm('Clear all logs?')) clearLogsMutation.mutate();
                        }}
                        className="text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded hover:bg-gray-200"
                    >
                        Clear Logs
                    </button>
                </div>

                <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200 text-sm">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-2 text-left font-medium text-gray-500">Time</th>
                                    <th className="px-4 py-2 text-left font-medium text-gray-500">Level</th>
                                    <th className="px-4 py-2 text-left font-medium text-gray-500">Source</th>
                                    <th className="px-4 py-2 text-left font-medium text-gray-500">Message</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {logs?.map((log: any) => (
                                    <tr key={log.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-2 whitespace-nowrap text-gray-500">
                                            {new Date(log.createdAt).toLocaleTimeString()}
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap">
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold
                                                ${log.level === 'ERROR' ? 'bg-red-100 text-red-800' :
                                                    log.level === 'WARN' ? 'bg-amber-100 text-amber-800' :
                                                        'bg-blue-100 text-blue-800'}`}>
                                                {log.level}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 whitespace-nowrap text-gray-600">{log.source}</td>
                                        <td className="px-4 py-2 text-gray-900">{log.message}</td>
                                    </tr>
                                ))}
                                {logs?.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500">No logs found</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
