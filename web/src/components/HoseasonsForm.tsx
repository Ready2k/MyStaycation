'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';

interface HoseasonsFormProps {
    initialData?: any;
    onSuccess: () => void;
    onBack: () => void;
}

export function HoseasonsForm({ initialData, onSuccess, onBack }: HoseasonsFormProps) {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState({
        name: '',
        region: '',
        dateStart: '',
        dateEnd: '',
        nights: 7,
        adults: 2,
        children: 0,
        pets: 0,
        budgetMax: null as number | null,
        propertyType: 'Any',
    });

    useEffect(() => {
        if (initialData) {
            const metadata = initialData.metadata || {};
            setFormData({
                name: initialData.name || '',
                region: initialData.region || '',
                dateStart: initialData.dateStart ? initialData.dateStart.split('T')[0] : '',
                dateEnd: initialData.dateEnd ? initialData.dateEnd.split('T')[0] : '',
                nights: initialData.durationNightsMin || 7,
                adults: initialData.partySizeAdults || 2,
                children: initialData.partySizeChildren || 0,
                pets: initialData.petsNumber || 0,
                budgetMax: initialData.budgetCeilingGbp || null,
                propertyType: metadata.propertyType || 'Any',
            });
        }
    }, [initialData]);

    // Auto-calculate End Date based on Start Date + Nights
    useEffect(() => {
        if (formData.dateStart && formData.nights > 0) {
            const startDate = new Date(formData.dateStart);
            if (!isNaN(startDate.getTime())) {
                const endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + formData.nights);
                const endDateStr = endDate.toISOString().split('T')[0];

                // Only update if different to avoid potential loops (though dependency array handles this)
                if (endDateStr !== formData.dateEnd) {
                    setFormData(prev => ({ ...prev, dateEnd: endDateStr }));
                }
            }
        }
    }, [formData.dateStart, formData.nights]);

    const saveMutation = useMutation({
        mutationFn: async (data: typeof formData) => {
            const payload = {
                name: data.name,
                // providerCode: 'hoseasons', // triggers DB lookup which might fail if not seeded
                enabledProviders: ['hoseasons'], // Direct adapter selection
                region: data.region,
                dateStart: data.dateStart,
                dateEnd: data.dateEnd,
                durationNightsMin: data.nights,
                durationNightsMax: data.nights,
                partySizeAdults: data.adults,
                partySizeChildren: data.children,
                petsNumber: data.pets,
                pets: data.pets > 0,
                budgetCeilingGbp: data.budgetMax || undefined,
                flexType: 'RANGE',
                metadata: { propertyType: data.propertyType }
            };

            if (initialData?.id) {
                const response = await api.put(`/profiles/${initialData.id}`, payload);
                return response.data;
            } else {
                const response = await api.post('/profiles', payload);
                return response.data;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profiles'] });
            onSuccess();
        },
        onError: (error: any) => {
            alert(`Failed to save watcher: ${error.response?.data?.message || error.message}`);
        },
    });

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 my-8">
                <div className="p-6 border-b">
                    <h2 className="text-2xl font-bold">Hoseasons Watcher</h2>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(formData); }} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Watcher Name</label>
                        <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border rounded-md" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">Region</label>
                        <input type="text" value={formData.region} onChange={(e) => setFormData({ ...formData, region: e.target.value })} className="w-full px-3 py-2 border rounded-md" placeholder="e.g., Cornwall, Lake District" />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Check-in</label>
                            <input type="date" required value={formData.dateStart} onChange={(e) => setFormData({ ...formData, dateStart: e.target.value })} className="w-full px-3 py-2 border rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">Check-out (Auto-calculated)</label>
                            <input
                                type="date"
                                readOnly
                                value={formData.dateEnd}
                                className="w-full px-3 py-2 border rounded-md bg-gray-100 text-gray-500 cursor-not-allowed"
                                title="Calculated from Check-in date + Nights"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">Nights</label>
                            <input type="number" min="1" value={formData.nights} onChange={(e) => setFormData({ ...formData, nights: parseInt(e.target.value) })} className="w-full px-3 py-2 border rounded-md" />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Adults</label>
                            <input type="number" min="1" value={formData.adults} onChange={(e) => setFormData({ ...formData, adults: parseInt(e.target.value) })} className="w-full px-3 py-2 border rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">Children</label>
                            <input type="number" min="0" value={formData.children} onChange={(e) => setFormData({ ...formData, children: parseInt(e.target.value) })} className="w-full px-3 py-2 border rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">Pets</label>
                            <input type="number" min="0" value={formData.pets} onChange={(e) => setFormData({ ...formData, pets: parseInt(e.target.value) })} className="w-full px-3 py-2 border rounded-md" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">Property Type</label>
                        <select value={formData.propertyType} onChange={(e) => setFormData({ ...formData, propertyType: e.target.value })} className="w-full px-3 py-2 border rounded-md">
                            <option>Any</option>
                            <option>Lodge</option>
                            <option>Cottage</option>
                            <option>Boat</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">Max Budget (£)</label>
                        <input type="number" min="0" value={formData.budgetMax || ''} onChange={(e) => setFormData({ ...formData, budgetMax: e.target.value ? parseInt(e.target.value) : null })} className="w-full px-3 py-2 border rounded-md" />
                    </div>
                </form>
                <div className="p-6 border-t flex justify-between">
                    <button onClick={onBack} className="px-4 py-2 border rounded-md">Back</button>
                    <button onClick={() => saveMutation.mutate(formData)} disabled={saveMutation.isPending} className="px-4 py-2 bg-blue-600 text-white rounded-md">{saveMutation.isPending ? 'Saving...' : (initialData ? 'Update' : 'Create')}</button>
                </div>
            </div>
        </div>
    );
}
