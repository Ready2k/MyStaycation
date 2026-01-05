'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import api from '@/services/api';
import { DeleteAccountModal } from '../../../components/DeleteAccountModal';

interface User {
    id: string;
    name?: string;
    email: string;
    mobile?: string;
    language: string;
    defaultCheckFrequencyHours: number;
    emailVerified: boolean;
    createdAt: string;
}

const FREQUENCY_OPTIONS = [
    { value: 12, label: '12 hours (Urgent trips)' },
    { value: 24, label: '24 hours (Daily)' },
    { value: 48, label: '48 hours (Recommended)' },
    { value: 72, label: '72 hours (Less frequent)' },
    { value: 168, label: '1 week (Minimal)' },
];

const LANGUAGE_OPTIONS = [
    { value: 'en', label: 'English' },
    { value: 'es', label: 'Español' },
    { value: 'fr', label: 'Français' },
    { value: 'de', label: 'Deutsch' },
    { value: 'it', label: 'Italiano' },
];

export default function SettingsPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        mobile: '',
        language: 'en',
        defaultCheckFrequencyHours: 48,
    });

    // Auto-hide toast after 3 seconds
    useEffect(() => {
        if (toast) {
            const timer = setTimeout(() => setToast(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [toast]);

    // Fetch current user
    const { data: userData, isLoading } = useQuery({
        queryKey: ['user', 'me'],
        queryFn: async () => {
            const { data } = await api.get<{ user: User }>('/users/me');
            return data.user;
        },
    });

    // Update form data when user data loads
    useEffect(() => {
        if (userData) {
            setFormData({
                name: userData.name || '',
                email: userData.email,
                mobile: userData.mobile || '',
                language: userData.language,
                defaultCheckFrequencyHours: userData.defaultCheckFrequencyHours,
            });
        }
    }, [userData]);

    // Update profile mutation
    const updateMutation = useMutation({
        mutationFn: async (data: Partial<typeof formData>) => {
            const payload: any = {};
            if (data.name !== undefined) payload.name = data.name;
            if (data.email !== undefined) payload.email = data.email;
            if (data.mobile !== undefined) payload.mobile = data.mobile || null;
            if (data.language !== undefined) payload.language = data.language;
            if (data.defaultCheckFrequencyHours !== undefined)
                payload.defaultCheckFrequencyHours = data.defaultCheckFrequencyHours;

            const { data: response } = await api.patch('/users/me', payload);
            return response;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['user', 'me'] });
            setToast({ message: 'Settings saved successfully!', type: 'success' });
        },
        onError: (error: any) => {
            setToast({
                message: error.response?.data?.error || 'Failed to update settings',
                type: 'error'
            });
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateMutation.mutate(formData);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full mx-auto mb-3"></div>
                    <p className="text-sm text-gray-600">Loading settings...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="px-4 py-6 sm:px-0 max-w-4xl mx-auto">
            <div className="mb-6">
                <button
                    onClick={() => router.push('/dashboard')}
                    className="text-sm text-gray-600 hover:text-gray-900 mb-3 flex items-center gap-1"
                >
                    ← Back to Dashboard
                </button>
                <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                <p className="mt-1 text-sm text-gray-500">
                    Manage your account preferences and monitoring settings.
                </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Personal Information */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold mb-4">Personal Information</h2>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Name
                            </label>
                            <input
                                type="text"
                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="Your name"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Email
                            </label>
                            <input
                                type="email"
                                required
                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            />
                            {!userData?.emailVerified && (
                                <p className="mt-1 text-xs text-amber-600">
                                    ⚠️ Email not verified
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Mobile (optional)
                            </label>
                            <input
                                type="tel"
                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                                value={formData.mobile}
                                onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                                placeholder="+447123456789"
                                pattern="^\+[1-9]\d{1,14}$"
                            />
                            <p className="mt-1 text-xs text-gray-500">
                                International format (e.g., +447123456789)
                            </p>
                        </div>
                    </div>
                </div>

                {/* Monitoring Preferences */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold mb-4">Monitoring Preferences</h2>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Check Frequency
                        </label>
                        <select
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                            value={formData.defaultCheckFrequencyHours}
                            onChange={(e) => setFormData({
                                ...formData,
                                defaultCheckFrequencyHours: parseInt(e.target.value)
                            })}
                        >
                            {FREQUENCY_OPTIONS.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <p className="mt-2 text-sm text-gray-600">
                            This will update all your existing watchers to check every{' '}
                            <strong>{formData.defaultCheckFrequencyHours} hours</strong>.
                        </p>
                    </div>
                </div>

                {/* Language & Region */}
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h2 className="text-lg font-semibold mb-4">Language & Region</h2>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Interface Language
                        </label>
                        <select
                            className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                            value={formData.language}
                            onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                        >
                            {LANGUAGE_OPTIONS.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                        <p className="mt-1 text-xs text-gray-500">
                            Full translation coming soon
                        </p>
                    </div>
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                    <button
                        type="submit"
                        disabled={updateMutation.isPending}
                        className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 font-medium"
                    >
                        {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </form>

            {/* Danger Zone */}
            <div className="mt-8 bg-white rounded-lg border-2 border-red-200 p-6">
                <h2 className="text-lg font-semibold text-red-900 mb-2">Danger Zone</h2>
                <p className="text-sm text-gray-600 mb-4">
                    Once you delete your account, there is no going back. This will permanently delete
                    all your profiles, watchers, price history, and alerts.
                </p>
                <button
                    type="button"
                    onClick={() => setDeleteModalOpen(true)}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 font-medium text-sm"
                >
                    Delete Account
                </button>
            </div>

            <DeleteAccountModal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
            />

            {/* Toast Notification */}
            {toast && (
                <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
                    <div className={`rounded-lg shadow-lg px-6 py-4 flex items-center gap-3 ${toast.type === 'success'
                        ? 'bg-green-600 text-white'
                        : 'bg-red-600 text-white'
                        }`}>
                        <span className="text-lg">
                            {toast.type === 'success' ? '✓' : '✕'}
                        </span>
                        <span className="font-medium">{toast.message}</span>
                        <button
                            onClick={() => setToast(null)}
                            className="ml-2 text-white hover:text-gray-200"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
