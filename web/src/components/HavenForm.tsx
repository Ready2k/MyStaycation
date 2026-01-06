'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';

interface HavenFormProps {
    initialData?: any;
    onSuccess: () => void;
    onBack: () => void;
}

interface HavenFormData {
    name: string;
    parks: string[];
    dateStart: string;
    dateEnd: string;
    nights: number;
    adults: number;
    children: number;
    infants: number;
    pets: number;
    budgetMax: number | null;
    accomType: string;
    features: string[];
}

const ACCOM_TYPES = [
    'Any',
    'Caravan',
    'Lodge',
    'Touring Pitch'
];

const FEATURES = [
    'Swimming Pool',
    'Entertainment',
    'Beach Nearby',
    'Fishing',
    'Kids Club',
    'Restaurant',
    'Bar',
    'WiFi'
];

export function HavenForm({ initialData, onSuccess, onBack }: HavenFormProps) {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState<HavenFormData>({
        name: '',
        parks: [],
        dateStart: '',
        dateEnd: '',
        nights: 7,
        adults: 2,
        children: 0,
        infants: 0,
        pets: 0,
        budgetMax: null,
        accomType: 'Any',
        features: [],
    });

    const [showFilters, setShowFilters] = useState(false);

    useEffect(() => {
        if (initialData) {
            const metadata = initialData.metadata || {};
            setFormData({
                name: initialData.name || '',
                parks: Array.isArray(initialData.parkIds) ? initialData.parkIds :
                    (typeof initialData.parkIds === 'string' ? initialData.parkIds.split(',') : []),
                dateStart: initialData.dateStart ? initialData.dateStart.split('T')[0] : '',
                dateEnd: initialData.dateEnd ? initialData.dateEnd.split('T')[0] : '',
                nights: initialData.durationNightsMin || 7,
                adults: initialData.partySizeAdults || 2,
                children: initialData.partySizeChildren || 0,
                infants: metadata.infants || 0,
                pets: initialData.petsNumber || 0,
                budgetMax: initialData.budgetCeilingGbp || null,
                accomType: metadata.accomType || 'Any',
                features: metadata.features || [],
            });
        }
    }, [initialData]);

    const saveMutation = useMutation({
        mutationFn: async (data: HavenFormData) => {
            const payload = {
                name: data.name,
                providerCode: 'haven',
                parkIds: data.parks,
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
                metadata: {
                    infants: data.infants,
                    accomType: data.accomType,
                    features: data.features,
                }
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
            console.error('Haven watcher save error:', error);
            alert(`Failed to save watcher: ${error.response?.data?.message || error.message}`);
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.parks.length === 0) {
            alert('Please select at least one Haven park');
            return;
        }
        saveMutation.mutate(formData);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 my-8">
                <div className="p-6 border-b border-gray-200">
                    <h2 className="text-2xl font-bold text-gray-900">Haven Watcher</h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Configure your Haven holiday search
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                    {/* Watcher Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Watcher Name
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g., Summer Haven Break"
                        />
                    </div>

                    {/* Parks - Note: Would need to fetch from ProviderConfig */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            📍 Haven Parks (enter park codes)
                        </label>
                        <input
                            type="text"
                            value={formData.parks.join(', ')}
                            onChange={(e) => setFormData({ ...formData, parks: e.target.value.split(',').map(p => p.trim()).filter(Boolean) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="e.g., DEVON_CLIFFS, PRIMROSE_VALLEY"
                        />
                        <p className="mt-1 text-xs text-gray-500">Comma-separated park codes</p>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Check-in</label>
                            <input
                                type="date"
                                required
                                value={formData.dateStart}
                                onChange={(e) => setFormData({ ...formData, dateStart: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Check-out</label>
                            <input
                                type="date"
                                required
                                value={formData.dateEnd}
                                onChange={(e) => setFormData({ ...formData, dateEnd: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Nights</label>
                            <input
                                type="number"
                                min="1"
                                max="14"
                                value={formData.nights}
                                onChange={(e) => setFormData({ ...formData, nights: parseInt(e.target.value) })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            />
                        </div>
                    </div>

                    {/* Party Size */}
                    <div className="grid grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Adults</label>
                            <input
                                type="number"
                                min="1"
                                max="8"
                                value={formData.adults}
                                onChange={(e) => setFormData({ ...formData, adults: parseInt(e.target.value) })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Children</label>
                            <input
                                type="number"
                                min="0"
                                max="8"
                                value={formData.children}
                                onChange={(e) => setFormData({ ...formData, children: parseInt(e.target.value) })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Infants</label>
                            <input
                                type="number"
                                min="0"
                                max="4"
                                value={formData.infants}
                                onChange={(e) => setFormData({ ...formData, infants: parseInt(e.target.value) })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Pets</label>
                            <input
                                type="number"
                                min="0"
                                max="2"
                                value={formData.pets}
                                onChange={(e) => setFormData({ ...formData, pets: parseInt(e.target.value) })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            />
                        </div>
                    </div>

                    {/* Budget */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            💰 Maximum Budget (optional)
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-2 text-gray-500">£</span>
                            <input
                                type="number"
                                min="0"
                                value={formData.budgetMax || ''}
                                onChange={(e) => setFormData({ ...formData, budgetMax: e.target.value ? parseInt(e.target.value) : null })}
                                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md"
                                placeholder="No limit"
                            />
                        </div>
                    </div>

                    {/* Advanced Filters */}
                    <div>
                        <button
                            type="button"
                            onClick={() => setShowFilters(!showFilters)}
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                            {showFilters ? '− Hide' : '+ Show'} Advanced Filters
                        </button>
                    </div>

                    {showFilters && (
                        <>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Accommodation Type
                                </label>
                                <select
                                    value={formData.accomType}
                                    onChange={(e) => setFormData({ ...formData, accomType: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                >
                                    {ACCOM_TYPES.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Features
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {FEATURES.map(feature => (
                                        <label key={feature} className="flex items-center text-sm">
                                            <input
                                                type="checkbox"
                                                checked={formData.features.includes(feature)}
                                                onChange={(e) => {
                                                    const updated = e.target.checked
                                                        ? [...formData.features, feature]
                                                        : formData.features.filter(f => f !== feature);
                                                    setFormData({ ...formData, features: updated });
                                                }}
                                                className="h-4 w-4 text-blue-600 rounded"
                                            />
                                            <span className="ml-2 text-gray-700">{feature}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </form>

                <div className="p-6 border-t border-gray-200 flex justify-between bg-gray-50">
                    <button
                        onClick={onBack}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                        Back
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={saveMutation.isPending}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                        {saveMutation.isPending ? 'Saving...' : (initialData ? 'Update Watcher' : 'Create Watcher')}
                    </button>
                </div>
            </div>
        </div>
    );
}
