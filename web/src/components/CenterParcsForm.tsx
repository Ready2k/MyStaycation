'use client';

import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/services/api';

interface CenterParcsFormProps {
    initialData?: any;
    onSuccess: () => void;
    onBack: () => void;
}

interface Lodge {
    adults: number;
    children: number; // 6-17 years
    toddlers: number; // 2-5 years
    infants: number;  // Under 2 years
    dogs: number;
    bedrooms: number;
}

interface CenterParcsFormData {
    name: string;
    villages: string[];
    dateStart: string;
    dateEnd: string;
    nights: number;
    lodges: Lodge[];
    budgetMax: number | null;
    // Filters
    accomTypes: string[];
    features: string[];
}

const VILLAGES = [
    { code: 'WO', name: 'Woburn Forest' },
    { code: 'WF', name: 'Whinfell Forest' },
    { code: 'SF', name: 'Sherwood Forest' },
    { code: 'LF', name: 'Longleat Forest' },
    { code: 'EF', name: 'Elveden Forest' },
];

const ACCOM_TYPES = [
    'Hotel and apartments',
    'Woodland',
    'Forest',
    'Exclusive',
    'Treehouse',
    'Waterside',
    'Woodland Explorer'
];

const FEATURES = [
    'Steam room', 'Sauna or Infrared room', 'Games room', 'Daily housekeeping service',
    'Mediahub', 'Two storey', 'Single storey', 'Detached', 'Hot tub',
    'Dedicated parking nearby', 'Hydrobath', 'Log burner', 'En-suites',
    'TV in all bedrooms', 'Sky package', 'Updated style', 'Log burner or electric fire',
    'Stylish and luxurious décor', 'Skylight', 'Interactive play panel', 'Coffee machine'
];

export function CenterParcsForm({ initialData, onSuccess, onBack }: CenterParcsFormProps) {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState<CenterParcsFormData>({
        name: '',
        villages: [],
        dateStart: '',
        dateEnd: '',
        nights: 7,
        lodges: [
            { adults: 2, children: 0, toddlers: 0, infants: 0, dogs: 0, bedrooms: 2 }
        ],
        budgetMax: null,
        accomTypes: [],
        features: [],
    });

    const [showFilters, setShowFilters] = useState(false);

    // Populate form with existing data when editing
    useEffect(() => {
        if (initialData) {
            const metadata = initialData.metadata || {};
            setFormData({
                name: initialData.name || '',
                villages: Array.isArray(initialData.parkIds) ? initialData.parkIds :
                    (typeof initialData.parkIds === 'string' ? initialData.parkIds.split(',') : []),
                dateStart: initialData.dateStart ? initialData.dateStart.split('T')[0] : '',
                dateEnd: initialData.dateEnd ? initialData.dateEnd.split('T')[0] : '',
                nights: initialData.durationNightsMin || 7,
                lodges: metadata.lodges || [{ adults: 2, children: 0, toddlers: 0, infants: 0, dogs: 0, bedrooms: 2 }],
                budgetMax: initialData.budgetCeilingGbp || null,
                accomTypes: metadata.accomTypes || [],
                features: metadata.features || [],
            });
        }
    }, [initialData]);

    const createMutation = useMutation({
        mutationFn: async (data: CenterParcsFormData) => {
            // Calculate total party size
            const totalAdults = data.lodges.reduce((sum, l) => sum + l.adults, 0);
            const totalChildren = data.lodges.reduce((sum, l) => sum + l.children + l.toddlers + l.infants, 0);

            const payload = {
                name: data.name,
                providerCode: 'centerparcs',
                parkIds: data.villages,
                dateStart: data.dateStart,
                dateEnd: data.dateEnd,
                durationNightsMin: data.nights,
                durationNightsMax: data.nights,
                partySizeAdults: totalAdults,
                partySizeChildren: totalChildren,
                budgetCeilingGbp: data.budgetMax || undefined,
                flexType: 'RANGE',
                // Store Center Parcs specific data in metadata
                metadata: {
                    lodges: data.lodges,
                    accomTypes: data.accomTypes,
                    features: data.features,
                }
            };

            console.log('Saving profile with payload:', payload);

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
            console.error('Profile creation error:', error);
            console.error('Error response:', error.response?.data);
            alert(`Failed to create watcher: ${error.response?.data?.message || error.message}`);
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.villages.length === 0) {
            alert('Please select at least one village');
            return;
        }
        createMutation.mutate(formData);
    };

    const toggleVillage = (code: string) => {
        setFormData(prev => ({
            ...prev,
            villages: prev.villages.includes(code)
                ? prev.villages.filter(v => v !== code)
                : [...prev.villages, code]
        }));
    };

    const addLodge = () => {
        if (formData.lodges.length < 3) {
            setFormData(prev => ({
                ...prev,
                lodges: [...prev.lodges, { adults: 2, children: 0, toddlers: 0, infants: 0, dogs: 0, bedrooms: 1 }]
            }));
        }
    };

    const removeLodge = (index: number) => {
        setFormData(prev => ({
            ...prev,
            lodges: prev.lodges.filter((_, i) => i !== index)
        }));
    };

    const updateLodge = (index: number, field: keyof Lodge, value: number) => {
        setFormData(prev => ({
            ...prev,
            lodges: prev.lodges.map((lodge, i) =>
                i === index ? { ...lodge, [field]: value } : lodge
            )
        }));
    };

    const toggleFilter = (type: 'accomTypes' | 'features', value: string) => {
        setFormData(prev => ({
            ...prev,
            [type]: prev[type].includes(value)
                ? prev[type].filter(v => v !== value)
                : [...prev[type], value]
        }));
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 my-8">
                <div className="p-6 border-b border-gray-200">
                    <h2 className="text-2xl font-bold text-gray-900">Center Parcs Watcher</h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Configure your Center Parcs holiday search with multiple lodges
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
                            placeholder="e.g., Summer Family Break"
                        />
                    </div>

                    {/* Villages */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            📍 Villages (select one or more)
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {VILLAGES.map((village) => (
                                <label
                                    key={village.code}
                                    className="flex items-center p-3 border border-gray-200 rounded-md cursor-pointer hover:bg-gray-50"
                                >
                                    <input
                                        type="checkbox"
                                        checked={formData.villages.includes(village.code)}
                                        onChange={() => toggleVillage(village.code)}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                    />
                                    <span className="ml-3 text-sm text-gray-900">{village.name}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Check-in Date
                            </label>
                            <input
                                type="date"
                                required
                                value={formData.dateStart}
                                onChange={(e) => setFormData({ ...formData, dateStart: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Check-out Date
                            </label>
                            <input
                                type="date"
                                required
                                value={formData.dateEnd}
                                onChange={(e) => setFormData({ ...formData, dateEnd: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Nights
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="14"
                                value={formData.nights}
                                onChange={(e) => setFormData({ ...formData, nights: parseInt(e.target.value) })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    </div>

                    {/* Lodges */}
                    <div>
                        <div className="flex justify-between items-center mb-3">
                            <label className="block text-sm font-medium text-gray-700">
                                🏠 Lodges ({formData.lodges.length}/3)
                            </label>
                            {formData.lodges.length < 3 && (
                                <button
                                    type="button"
                                    onClick={addLodge}
                                    className="text-sm text-blue-600 hover:text-blue-700"
                                >
                                    + Add Lodge
                                </button>
                            )}
                        </div>

                        {formData.lodges.map((lodge, index) => (
                            <div key={index} className="mb-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="font-medium text-gray-900">Lodge {index + 1}</h4>
                                    {formData.lodges.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeLodge(index)}
                                            className="text-sm text-red-600 hover:text-red-700"
                                        >
                                            Remove
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs text-gray-600 mb-1">Adults (18+)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="8"
                                            value={lodge.adults}
                                            onChange={(e) => updateLodge(index, 'adults', parseInt(e.target.value))}
                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-600 mb-1">Children (6-17)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="8"
                                            value={lodge.children}
                                            onChange={(e) => updateLodge(index, 'children', parseInt(e.target.value))}
                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-600 mb-1">Toddlers (2-5)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="8"
                                            value={lodge.toddlers}
                                            onChange={(e) => updateLodge(index, 'toddlers', parseInt(e.target.value))}
                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-600 mb-1">Infants (&lt;2)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="4"
                                            value={lodge.infants}
                                            onChange={(e) => updateLodge(index, 'infants', parseInt(e.target.value))}
                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-600 mb-1">Dogs (max 2)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="2"
                                            value={lodge.dogs}
                                            onChange={(e) => updateLodge(index, 'dogs', parseInt(e.target.value))}
                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs text-gray-600 mb-1">Bedrooms</label>
                                        <select
                                            value={lodge.bedrooms}
                                            onChange={(e) => updateLodge(index, 'bedrooms', parseInt(e.target.value))}
                                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                                        >
                                            <option value="1">1</option>
                                            <option value="2">2</option>
                                            <option value="3">3</option>
                                            <option value="4">4</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        ))}
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
                                className="w-full pl-8 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="No limit"
                            />
                        </div>
                    </div>

                    {/* Advanced Filters Toggle */}
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
                            {/* Accommodation Types */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Accommodation Type
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {ACCOM_TYPES.map((type) => (
                                        <label key={type} className="flex items-center text-sm">
                                            <input
                                                type="checkbox"
                                                checked={formData.accomTypes.includes(type)}
                                                onChange={() => toggleFilter('accomTypes', type)}
                                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                                            />
                                            <span className="ml-2 text-gray-700">{type}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Features */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Features
                                </label>
                                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                                    {FEATURES.map((feature) => (
                                        <label key={feature} className="flex items-center text-sm">
                                            <input
                                                type="checkbox"
                                                checked={formData.features.includes(feature)}
                                                onChange={() => toggleFilter('features', feature)}
                                                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
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
                        disabled={createMutation.isPending}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
                    >
                        {createMutation.isPending ? 'Creating...' : 'Create Watcher'}
                    </button>
                </div>
            </div>
        </div>
    );
}
