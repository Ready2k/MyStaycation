'use client';

import { useState } from 'react';

interface Provider {
    code: string;
    name: string;
    description: string;
    icon: string;
}

const PROVIDERS: Provider[] = [
    { code: 'centerparcs', name: 'Center Parcs', description: '5 UK forest villages', icon: '🏕️' },
    { code: 'haven', name: 'Haven', description: '40+ UK holiday parks', icon: '🌊' },
    { code: 'hoseasons', name: 'Hoseasons', description: '300+ UK locations', icon: '🏖️' },
    { code: 'parkdean', name: 'Parkdean Resorts', description: '60+ UK parks', icon: '🎡' },
    { code: 'butlins', name: 'Butlin\'s', description: '3 iconic UK resorts', icon: '🎪' },
    { code: 'awayresorts', name: 'Away Resorts', description: 'Premium UK parks', icon: '⛱️' },
];

interface ProviderSelectionProps {
    onSelect: (providerCode: string) => void;
    onCancel: () => void;
}

export function ProviderSelection({ onSelect, onCancel }: ProviderSelectionProps) {
    const [selected, setSelected] = useState<string | null>(null);

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200">
                    <h2 className="text-2xl font-bold text-gray-900">Create New Holiday Watcher</h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Choose which provider you'd like to search
                    </p>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {PROVIDERS.map((provider) => (
                        <button
                            key={provider.code}
                            onClick={() => setSelected(provider.code)}
                            className={`p-6 border-2 rounded-lg text-left transition-all hover:shadow-md ${selected === provider.code
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                        >
                            <div className="flex items-start space-x-4">
                                <span className="text-4xl">{provider.icon}</span>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-lg text-gray-900">
                                        {provider.name}
                                    </h3>
                                    <p className="text-sm text-gray-600 mt-1">
                                        {provider.description}
                                    </p>
                                </div>
                            </div>
                        </button>
                    ))}
                </div>

                <div className="p-6 border-t border-gray-200 flex justify-end space-x-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => selected && onSelect(selected)}
                        disabled={!selected}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Continue
                    </button>
                </div>
            </div>
        </div>
    );
}
