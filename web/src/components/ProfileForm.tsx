import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

interface ProfileFormData {
    name: string;
    partySizeAdults: number;
    partySizeChildren: number;
    flexType: 'FIXED' | 'RANGE' | 'FLEXI';
    dateStart?: string;
    dateEnd?: string;
    durationNightsMin: number;
    durationNightsMax: number;
    peakTolerance: 'OFFPEAK_ONLY' | 'MIXED' | 'PEAK_OK';
    budgetCeilingGbp?: number;
    enabled: boolean;
    pets: boolean;
}

const initialFormState: ProfileFormData = {
    name: '',
    partySizeAdults: 2,
    partySizeChildren: 0,
    flexType: 'RANGE',
    durationNightsMin: 3,
    durationNightsMax: 7,
    peakTolerance: 'MIXED',
    enabled: true,
    pets: false,
};

interface ProfileFormProps {
    initialData?: any;
    onSuccess: () => void;
    onCancel: () => void;
}

export function ProfileForm({ initialData, onSuccess, onCancel }: ProfileFormProps) {
    const [formData, setFormData] = useState<ProfileFormData>(initialFormState);
    const queryClient = useQueryClient();

    useEffect(() => {
        if (initialData) {
            setFormData({
                ...initialData,
                dateStart: initialData.dateStart ? initialData.dateStart.split('T')[0] : '',
                dateEnd: initialData.dateEnd ? initialData.dateEnd.split('T')[0] : '',
            });
        }
    }, [initialData]);

    const mutation = useMutation({
        mutationFn: async (data: ProfileFormData) => {
            // Clean up empty date strings
            const payload = { ...data };
            if (!payload.dateStart) delete payload.dateStart;
            if (!payload.dateEnd) delete payload.dateEnd;

            if (initialData?.id) {
                const { data: res } = await api.put(`/profiles/${initialData.id}`, payload);
                return res;
            } else {
                const { data: res } = await api.post('/profiles', payload);
                return res;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profiles'] });
            onSuccess();
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-6">
                {initialData ? 'Edit Watcher' : 'New Holiday Watcher'}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Watcher Name</label>
                    <input
                        type="text"
                        required
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        placeholder="e.g. Summer 2024 Cornwall"
                        value={formData.name}
                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Adults</label>
                    <input
                        type="number"
                        min="1"
                        required
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        value={formData.partySizeAdults}
                        onChange={e => setFormData({ ...formData, partySizeAdults: parseInt(e.target.value) })}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Children</label>
                    <input
                        type="number"
                        min="0"
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        value={formData.partySizeChildren}
                        onChange={e => setFormData({ ...formData, partySizeChildren: parseInt(e.target.value) })}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Min Nights</label>
                    <input
                        type="number"
                        min="1"
                        required
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        value={formData.durationNightsMin}
                        onChange={e => setFormData({ ...formData, durationNightsMin: parseInt(e.target.value) })}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Nights</label>
                    <input
                        type="number"
                        min="1"
                        required
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        value={formData.durationNightsMax}
                        onChange={e => setFormData({ ...formData, durationNightsMax: parseInt(e.target.value) })}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Earliest Start Date</label>
                    <input
                        type="date"
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        value={formData.dateStart || ''}
                        onChange={e => setFormData({ ...formData, dateStart: e.target.value })}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Latest End Date</label>
                    <input
                        type="date"
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        value={formData.dateEnd || ''}
                        onChange={e => setFormData({ ...formData, dateEnd: e.target.value })}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Budget (£)</label>
                    <input
                        type="number"
                        min="0"
                        step="10"
                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                        value={formData.budgetCeilingGbp || ''}
                        onChange={e => setFormData({ ...formData, budgetCeilingGbp: e.target.value ? parseFloat(e.target.value) : undefined })}
                    />
                </div>

                <div className="flex items-center pt-6">
                    <input
                        id="pets-checkbox"
                        type="checkbox"
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        checked={formData.pets}
                        onChange={e => setFormData({ ...formData, pets: e.target.checked })}
                    />
                    <label htmlFor="pets-checkbox" className="ml-2 block text-sm text-gray-900">
                        Pets Allowed 🐾
                    </label>
                </div>
            </div>

            {mutation.isError && (
                <div className="mt-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
                    Error saving watcher. Please try again.
                </div>
            )}

            <div className="mt-6 flex justify-end space-x-3">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={mutation.isPending}
                    className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                >
                    {mutation.isPending ? 'Saving...' : (initialData ? 'Update Watcher' : 'Create Watcher')}
                </button>
            </div>
        </form>
    );
}
