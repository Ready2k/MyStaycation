'use client';

interface Provider {
    code: string;
    name: string;
    description: string;
    icon: string;
}

const PROVIDERS: Provider[] = [
    { code: 'centerparcs', name: 'Center Parcs',     description: '5 UK forest villages',   icon: '🏕️' },
    { code: 'haven',       name: 'Haven',             description: '40+ UK holiday parks',   icon: '🌊' },
    { code: 'hoseasons',   name: 'Hoseasons',         description: '300+ UK locations',      icon: '🏖️' },
    { code: 'parkdean',    name: 'Parkdean Resorts',  description: '60+ UK parks',           icon: '🎡' },
    { code: 'butlins',     name: "Butlin's",          description: '3 iconic UK resorts',    icon: '🎪' },
    { code: 'awayresorts', name: 'Away Resorts',      description: 'Premium UK parks',       icon: '⛱️' },
];

interface ProviderSelectionProps {
    onSelect: (providerCode: string) => void;
    onCancel: () => void;
}

export function ProviderSelection({ onSelect, onCancel }: ProviderSelectionProps) {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-gray-200 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Create New Holiday Watcher</h2>
                        <p className="mt-1 text-sm text-gray-600">Choose a provider to get started</p>
                    </div>
                    <button
                        onClick={onCancel}
                        className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                    >
                        ×
                    </button>
                </div>

                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                    {PROVIDERS.map((provider) => (
                        <button
                            key={provider.code}
                            onClick={() => onSelect(provider.code)}
                            className="p-5 border-2 border-gray-200 rounded-lg text-left transition-all hover:border-blue-400 hover:shadow-md hover:bg-blue-50 group"
                        >
                            <div className="flex items-center gap-4">
                                <span className="text-3xl">{provider.icon}</span>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-gray-900 group-hover:text-blue-700">
                                        {provider.name}
                                    </h3>
                                    <p className="text-sm text-gray-500 mt-0.5">{provider.description}</p>
                                </div>
                                <span className="text-gray-300 group-hover:text-blue-400 text-lg">→</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
