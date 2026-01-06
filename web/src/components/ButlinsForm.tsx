'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';

interface ButlinsFormProps {
    initialData?: any;
    onSuccess: () => void;
    onBack: () => void;
}

const RESORTS = [
    { code: 'BOGNOR', name: 'Bognor Regis' },
    { code: 'MINEHEAD', name: 'Minehead' },
    { code: 'SKEGNESS', name: 'Skegness' },
];

export function ButlinsForm({ initialData, onSuccess, onBack }: ButlinsFormProps) {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState({
        name: '',
        resort: '',
        dateStart: '',
        dateEnd: '',
        nights: 3,
        adults: 2,
        children: 0,
        budgetMax: null as number | null,
        roomType: 'Standard',
    });

    useEffect(() => {
        if (initialData) {
            const metadata = initialData.metadata || {};
            setFormData({
                name: initialData.name || '',
                resort: (initialData.parkIds && initialData.parkIds[0]) || '',
                dateStart: initialData.dateStart ? initialData.dateStart.split('T')[0] : '',
                dateEnd: initialData.dateEnd ? initialData.dateEnd.split('T')[0] : '',
                nights: initialData.durationNightsMin || 3,
                adults: initialData.partySizeAdults || 2,
                children: initialData.partySizeChildren || 0,
                budgetMax: initialData.budgetCeilingGbp || null,
                roomType: metadata.roomType || 'Standard',
            });
        }
    }, [initialData]);

    const saveMutation = useMutation({
        mutationFn: async (data: typeof formData) => {
            const payload = {
                name: data.name,
                providerCode: 'butlins',
                parkIds: data.resort ? [data.resort] : [],
                dateStart: data.dateStart,
                dateEnd: data.dateEnd,
                durationNightsMin: data.nights,
                durationNightsMax: data.nights,
                partySizeAdults: data.adults,
                partySizeChildren: data.children,
                budgetCeilingGbp: data.budgetMax || undefined,
                flexType: 'FIXED',
                metadata: { roomType: data.roomType }
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
                    <h2 className="text-2xl font-bold">Butlins Watcher</h2>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(formData); }} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-2">Watcher Name</label>
                        <input type="text" required value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 border rounded-md" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">Resort</label>
                        <select required value={formData.resort} onChange={(e) => setFormData({ ...formData, resort: e.target.value })} className="w-full px-3 py-2 border rounded-md">
                            <option value="">Select Resort</option>
                            {RESORTS.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Check-in</label>
                            <input type="date" required value={formData.dateStart} onChange={(e) => setFormData({ ...formData, dateStart: e.target.value })} className="w-full px-3 py-2 border rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">Check-out</label>
                            <input type="date" required value={formData.dateEnd} onChange={(e) => setFormData({ ...formData, dateEnd: e.target.value })} className="w-full px-3 py-2 border rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">Nights</label>
                            <input type="number" min="1" value={formData.nights} onChange={(e) => setFormData({ ...formData, nights: parseInt(e.target.value) })} className="w-full px-3 py-2 border rounded-md" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Adults</label>
                            <input type="number" min="1" value={formData.adults} onChange={(e) => setFormData({ ...formData, adults: parseInt(e.target.value) })} className="w-full px-3 py-2 border rounded-md" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-2">Children</label>
                            <input type="number" min="0" value={formData.children} onChange={(e) => setFormData({ ...formData, children: parseInt(e.target.value) })} className="w-full px-3 py-2 border rounded-md" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-2">Room Type</label>
                        <select value={formData.roomType} onChange={(e) => setFormData({ ...formData, roomType: e.target.value })} className="w-full px-3 py-2 border rounded-md">
                            <option>Standard</option>
                            <option>Silver</option>
                            <option>Deluxe</option>
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
