import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../services/api';

interface ProfileFormData {
    // Core
    name: string;
    partySizeAdults: number;
    partySizeChildren: number;
    pets: boolean;
    petsNumber: number;
    budgetCeilingGbp?: number;
    enabled: boolean;

    // Dates
    flexType: 'FIXED' | 'RANGE' | 'FLEXI';
    dateStart?: string;
    dateEnd?: string;
    durationNightsMin: number;
    durationNightsMax: number;
    stayPattern: 'ANY' | 'MIDWEEK' | 'WEEKEND' | 'FULL_WEEK';
    schoolHolidays: 'ALLOW' | 'AVOID' | 'ONLY';
    peakTolerance: 'OFFPEAK_ONLY' | 'MIXED' | 'PEAK_OK';

    // Accommodation
    accommodationType: 'ANY' | 'LODGE' | 'CARAVAN' | 'APARTMENT' | 'COTTAGE' | 'HOTEL';
    tier: 'STANDARD' | 'PREMIUM' | 'LUXURY';
    minBedrooms: number;

    // Accessibility
    stepFreeAccess: boolean;
    accessibleBathroom: boolean;

    // Alerts
    alertSensitivity: 'INSTANT' | 'DIGEST' | 'EXCEPTIONAL_ONLY';
}

const initialFormState: ProfileFormData = {
    name: '',
    partySizeAdults: 2,
    partySizeChildren: 0,
    pets: false,
    petsNumber: 0,
    enabled: true,

    flexType: 'RANGE',
    durationNightsMin: 3,
    durationNightsMax: 7,
    stayPattern: 'ANY',
    schoolHolidays: 'ALLOW',
    peakTolerance: 'MIXED',

    accommodationType: 'ANY',
    tier: 'STANDARD',
    minBedrooms: 0,

    stepFreeAccess: false,
    accessibleBathroom: false,

    alertSensitivity: 'INSTANT',
};

interface ProfileFormProps {
    initialData?: any;
    onSuccess: () => void;
    onCancel: () => void;
}

export function ProfileForm({ initialData, onSuccess, onCancel }: ProfileFormProps) {
    const [formData, setFormData] = useState<ProfileFormData>(initialFormState);
    const [activeSection, setActiveSection] = useState<string | null>('accommodation'); // Example default

    const toggleSection = (section: string) => {
        setActiveSection(activeSection === section ? null : section);
    };

    const queryClient = useQueryClient();

    useEffect(() => {
        if (initialData) {
            setFormData({
                ...initialFormState, // Ensure defaults for new fields
                ...initialData,
                dateStart: initialData.dateStart ? initialData.dateStart.split('T')[0] : '',
                dateEnd: initialData.dateEnd ? initialData.dateEnd.split('T')[0] : '',
            });
        }
    }, [initialData]);

    const mutation = useMutation({
        mutationFn: async (data: ProfileFormData) => {
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

    const SectionHeader = ({ title, id }: { title: string, id: string }) => (
        <button
            type="button"
            onClick={() => toggleSection(id)}
            className="w-full flex justify-between items-center py-3 text-left font-medium text-gray-900 border-b border-gray-100 focus:outline-none"
        >
            <span>{title}</span>
            <span>{activeSection === id ? '−' : '+'}</span>
        </button>
    );

    return (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">
                    {initialData ? 'Edit Watcher' : 'New Holiday Watcher'}
                </h2>

                {/* --- CORE SECTION (Always Visible) --- */}
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
                        <input type="number" min="1" required className="w-full rounded-md border-gray-300 shadow-sm"
                            value={formData.partySizeAdults} onChange={e => setFormData({ ...formData, partySizeAdults: parseInt(e.target.value) })} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Children</label>
                        <input type="number" min="0" className="w-full rounded-md border-gray-300 shadow-sm"
                            value={formData.partySizeChildren} onChange={e => setFormData({ ...formData, partySizeChildren: parseInt(e.target.value) })} />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                        <input type="date" className="w-full rounded-md border-gray-300 shadow-sm"
                            value={formData.dateStart || ''} onChange={e => setFormData({ ...formData, dateStart: e.target.value })} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                        <input type="date" className="w-full rounded-md border-gray-300 shadow-sm"
                            value={formData.dateEnd || ''} onChange={e => setFormData({ ...formData, dateEnd: e.target.value })} />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Budget (£)</label>
                        <input type="number" min="0" step="10" className="w-full rounded-md border-gray-300 shadow-sm"
                            value={formData.budgetCeilingGbp || ''} onChange={e => setFormData({ ...formData, budgetCeilingGbp: e.target.value ? parseFloat(e.target.value) : undefined })} />
                    </div>

                    <div className="flex items-center pt-6 space-x-4">
                        <label className="flex items-center">
                            <input type="checkbox" className="rounded text-primary-600 focus:ring-primary-500"
                                checked={formData.pets} onChange={e => setFormData({ ...formData, pets: e.target.checked })} />
                            <span className="ml-2 text-sm text-gray-900">Pets Allowed 🐾</span>
                        </label>
                    </div>
                </div>
            </div>

            {/* --- ADVANCED ACCOMMODATION --- */}
            <div className="px-6 py-2 bg-gray-50 border-b border-gray-100">
                <SectionHeader title="Accommodation Preference" id="accommodation" />
                {activeSection === 'accommodation' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4 pt-2">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                            <select className="w-full rounded-md border-gray-300 shadow-sm"
                                value={formData.accommodationType}
                                onChange={e => setFormData({ ...formData, accommodationType: e.target.value as any })}>
                                <option value="ANY">Any Type</option>
                                <option value="LODGE">Lodge</option>
                                <option value="CARAVAN">Caravan</option>
                                <option value="APARTMENT">Apartment</option>
                                <option value="COTTAGE">Cottage</option>
                                <option value="HOTEL">Hotel</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Quality Tier</label>
                            <select className="w-full rounded-md border-gray-300 shadow-sm"
                                value={formData.tier}
                                onChange={e => setFormData({ ...formData, tier: e.target.value as any })}>
                                <option value="STANDARD">Standard</option>
                                <option value="PREMIUM">Premium</option>
                                <option value="LUXURY">Luxury</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Min Bedrooms</label>
                            <input type="number" min="0" className="w-full rounded-md border-gray-300 shadow-sm"
                                value={formData.minBedrooms} onChange={e => setFormData({ ...formData, minBedrooms: parseInt(e.target.value) })} />
                        </div>
                    </div>
                )}
            </div>

            {/* --- DURATION & FLEXIBILITY --- */}
            <div className="px-6 py-2 bg-gray-50 border-b border-gray-100">
                <SectionHeader title="Duration & Flexibility" id="flexibility" />
                {activeSection === 'flexibility' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4 pt-2">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Min Nights</label>
                            <input type="number" min="1" className="w-full rounded-md border-gray-300 shadow-sm"
                                value={formData.durationNightsMin} onChange={e => setFormData({ ...formData, durationNightsMin: parseInt(e.target.value) })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Max Nights</label>
                            <input type="number" min="1" className="w-full rounded-md border-gray-300 shadow-sm"
                                value={formData.durationNightsMax} onChange={e => setFormData({ ...formData, durationNightsMax: parseInt(e.target.value) })} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Stay Pattern</label>
                            <select className="w-full rounded-md border-gray-300 shadow-sm"
                                value={formData.stayPattern}
                                onChange={e => setFormData({ ...formData, stayPattern: e.target.value as any })}>
                                <option value="ANY">Any Start Day</option>
                                <option value="MIDWEEK">Midweek (Mon-Fri)</option>
                                <option value="WEEKEND">Weekend (Fri-Mon)</option>
                                <option value="FULL_WEEK">Full Week (Sat-Sat)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">School Holidays</label>
                            <select className="w-full rounded-md border-gray-300 shadow-sm"
                                value={formData.schoolHolidays}
                                onChange={e => setFormData({ ...formData, schoolHolidays: e.target.value as any })}>
                                <option value="ALLOW">Allow (Pricey)</option>
                                <option value="AVOID">Avoid (Cheaper)</option>
                                <option value="ONLY">School Hols Only</option>
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* --- PETS & ACCESS --- */}
            <div className="px-6 py-2 bg-gray-50 border-b border-gray-100">
                <SectionHeader title="Pets & Accessibility" id="access" />
                {activeSection === 'access' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4 pt-2">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Number of Pets</label>
                            <input type="number" min="0" className="w-full rounded-md border-gray-300 shadow-sm"
                                disabled={!formData.pets}
                                value={formData.petsNumber} onChange={e => setFormData({ ...formData, petsNumber: parseInt(e.target.value) })} />
                        </div>
                        <div className="flex flex-col space-y-3 pt-6">
                            <label className="flex items-center">
                                <input type="checkbox" className="rounded text-primary-600 focus:ring-primary-500"
                                    checked={formData.stepFreeAccess} onChange={e => setFormData({ ...formData, stepFreeAccess: e.target.checked })} />
                                <span className="ml-2 text-sm text-gray-900">Step-free Access Required</span>
                            </label>
                            <label className="flex items-center">
                                <input type="checkbox" className="rounded text-primary-600 focus:ring-primary-500"
                                    checked={formData.accessibleBathroom} onChange={e => setFormData({ ...formData, accessibleBathroom: e.target.checked })} />
                                <span className="ml-2 text-sm text-gray-900">Accessible Bathroom Required</span>
                            </label>
                        </div>
                    </div>
                )}
            </div>

            {/* --- ALERT SETTINGS --- */}
            <div className="px-6 py-2 bg-gray-50">
                <SectionHeader title="Alert Preferences" id="alerts" />
                {activeSection === 'alerts' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-4 pt-2">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Alert Sensitivity</label>
                            <select className="w-full rounded-md border-gray-300 shadow-sm"
                                value={formData.alertSensitivity}
                                onChange={e => setFormData({ ...formData, alertSensitivity: e.target.value as any })}>
                                <option value="INSTANT">Instant (Every price drop)</option>
                                <option value="DIGEST">Daily Digest</option>
                                <option value="EXCEPTIONAL_ONLY">Exceptional Deals Only (&gt;20% drop)</option>
                            </select>
                            <p className="mt-1 text-xs text-gray-500">
                                "Exceptional Only" reduces noise and only emails you when we find significant savings.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {mutation.isError && (
                <div className="p-6 pb-0">
                    <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm">
                        Error saving watcher. Please try again.
                    </div>
                </div>
            )}

            <div className="p-6 flex justify-end space-x-3 bg-gray-50 border-t border-gray-100">
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
