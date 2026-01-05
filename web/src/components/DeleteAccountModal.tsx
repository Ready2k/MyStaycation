'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/services/api';

interface DeleteAccountModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function DeleteAccountModal({ isOpen, onClose }: DeleteAccountModalProps) {
    const router = useRouter();
    const [confirmation, setConfirmation] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);

    const deleteMutation = useMutation({
        mutationFn: async () => {
            const { data } = await api.delete('/users/me', {
                data: { confirmation: 'DELETE' }
            });
            return data;
        },
        onSuccess: () => {
            // Clear local storage
            localStorage.removeItem('token');
            // Redirect to landing page
            router.push('/');
        },
        onError: (error: any) => {
            alert(error.response?.data?.error || 'Failed to delete account');
            setIsDeleting(false);
        },
    });

    const handleDelete = () => {
        if (confirmation !== 'DELETE') {
            return;
        }
        setIsDeleting(true);
        deleteMutation.mutate();
    };

    const handleClose = () => {
        if (!isDeleting) {
            setConfirmation('');
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Delete Account
                </h3>

                <div className="mb-6 space-y-3">
                    <p className="text-sm text-gray-700">
                        This action <strong>cannot be undone</strong>. This will permanently delete:
                    </p>
                    <ul className="text-sm text-gray-600 list-disc list-inside space-y-1 ml-2">
                        <li>Your account and profile</li>
                        <li>All holiday watchers</li>
                        <li>All price history data</li>
                        <li>All insights and alerts</li>
                    </ul>
                    <p className="text-sm text-red-600 font-medium mt-4">
                        Type <code className="bg-red-50 px-1 py-0.5 rounded">DELETE</code> to confirm:
                    </p>
                </div>

                <input
                    type="text"
                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 mb-4"
                    value={confirmation}
                    onChange={(e) => setConfirmation(e.target.value)}
                    placeholder="Type DELETE"
                    disabled={isDeleting}
                    autoFocus
                />

                <div className="flex justify-end gap-3">
                    <button
                        onClick={handleClose}
                        disabled={isDeleting}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleDelete}
                        disabled={confirmation !== 'DELETE' || isDeleting}
                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                        {isDeleting ? 'Deleting...' : 'Delete Account'}
                    </button>
                </div>
            </div>
        </div>
    );
}
