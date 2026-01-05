'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import api from '@/services/api';
import { ConfirmationModal } from '@/components/ConfirmationModal';

interface AdminUser {
    id: string;
    email: string;
    name?: string;
    role: 'USER' | 'ADMIN';
    createdAt: string;
    profileCount: number;
}

export default function UsersTab() {
    const queryClient = useQueryClient();
    const [resetResult, setResetResult] = useState<{ email: string; pass: string } | null>(null);
    const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null);
    const [userToReset, setUserToReset] = useState<AdminUser | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['admin', 'users'],
        queryFn: async () => {
            const { data } = await api.get<{ users: AdminUser[] }>('/admin/users');
            return data.users;
        }
    });

    const roleMutation = useMutation({
        mutationFn: async ({ id, role }: { id: string; role: string }) => {
            await api.patch(`/admin/users/${id}/role`, { role });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
        }
    });

    const resetPassMutation = useMutation({
        mutationFn: async (id: string) => {
            const { data } = await api.post<{ tempPassword: string }>(`/admin/users/${id}/reset-password`);
            return data.tempPassword;
        },
        onSuccess: (tempPass, variables) => {
            // Find user email for display
            const user = data?.find(u => u.id === variables);
            if (user) {
                setResetResult({ email: user.email, pass: tempPass });
            }
            setUserToReset(null); // Close modal
        }
    });

    const deleteUserMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/admin/users/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
            setUserToDelete(null); // Close modal
        },
        onError: (error: any) => {
            alert(`Failed to delete user: ${error.response?.data?.error || error.message}`);
        }
    });

    if (isLoading) return <div>Loading users...</div>;

    return (
        <div className="space-y-6">
            <ConfirmationModal
                isOpen={!!userToDelete}
                onClose={() => setUserToDelete(null)}
                onConfirm={() => userToDelete && deleteUserMutation.mutate(userToDelete.id)}
                title="Delete User"
                message={`Are you sure you want to permanently delete user ${userToDelete?.email}? This action cannot be undone and will delete all their profiles and data.`}
                confirmLabel={deleteUserMutation.isPending ? 'Deleting...' : 'Delete User'}
                isDestructive={true}
            />

            <ConfirmationModal
                isOpen={!!userToReset}
                onClose={() => setUserToReset(null)}
                onConfirm={() => userToReset && resetPassMutation.mutate(userToReset.id)}
                title="Reset Password"
                message={`Are you sure you want to reset the password for ${userToReset?.email}? A temporary password will be generated.`}
                confirmLabel={resetPassMutation.isPending ? 'Resetting...' : 'Reset Password'}
                isDestructive={false}
            />

            {resetResult && (
                <div className="bg-green-50 border border-green-200 p-4 rounded-md flex justify-between items-center">
                    <div>
                        <p className="font-bold text-green-800">Password Reset Successful</p>
                        <p className="text-sm text-green-700">User: {resetResult.email}</p>
                        <p className="mt-1">Temporary Password: <code className="bg-white px-2 py-1 rounded border">{resetResult.pass}</code></p>
                    </div>
                    <button type="button" onClick={() => setResetResult(null)} className="text-green-600 hover:text-green-800">✕</button>
                </div>
            )}

            <div className="bg-white shadow overflow-hidden sm:rounded-lg">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Profiles</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {data?.map((user) => (
                            <tr key={user.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div>
                                            <div className="text-sm font-medium text-gray-900">{user.name || 'Unnamed'}</div>
                                            <div className="text-sm text-gray-500">{user.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${user.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'}`}>
                                        {user.role}
                                    </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {user.profileCount}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {new Date(user.createdAt).toLocaleDateString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            roleMutation.mutate({ id: user.id, role: user.role === 'ADMIN' ? 'USER' : 'ADMIN' });
                                        }}
                                        className="text-indigo-600 hover:text-indigo-900"
                                        disabled={roleMutation.isPending}
                                    >
                                        {user.role === 'ADMIN' ? 'Demote' : 'Make Admin'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setUserToReset(user);
                                        }}
                                        className="text-amber-600 hover:text-amber-900"
                                        disabled={resetPassMutation.isPending}
                                    >
                                        Reset Pass
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            setUserToDelete(user);
                                        }}
                                        className="text-red-600 hover:text-red-900"
                                    >
                                        Delete
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
