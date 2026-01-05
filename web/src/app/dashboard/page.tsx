'use client';

import { useState } from 'react';
import { ProfileList } from '@/components/ProfileList';
import { ProfileForm } from '@/components/ProfileForm';
import { AlertTicker } from '@/components/AlertTicker';
import { ProviderSelection } from '@/components/ProviderSelection';
import { CenterParcsForm } from '@/components/CenterParcsForm';

type WizardStep = 'list' | 'select-provider' | 'centerparcs' | 'edit';

export default function DashboardPage() {
    const [step, setStep] = useState<WizardStep>('list');
    const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
    const [editingProfile, setEditingProfile] = useState<any>(null);

    const handleProviderSelect = (providerCode: string) => {
        setSelectedProvider(providerCode);
        // Route to provider-specific form
        if (providerCode === 'centerparcs') {
            setStep('centerparcs');
        } else {
            // For now, fall back to old form for other providers
            alert(`${providerCode} form coming soon! Using legacy form for now.`);
            setStep('edit'); // Will use old ProfileForm
        }
    };

    const handleWatcherCreated = () => {
        setStep('list');
        setSelectedProvider(null);
        setEditingProfile(null);
    };

    return (
        <div className="px-4 py-6 sm:px-0">
            {/* Alert Ticker */}
            <AlertTicker />

            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Your Holiday Watchers</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Manage your holiday preferences and get deal alerts.
                    </p>
                </div>
                {step === 'list' && (
                    <button
                        onClick={() => setStep('select-provider')}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                        + New Watcher
                    </button>
                )}
            </div>

            {step === 'list' && (
                <ProfileList
                    onEdit={(profile) => {
                        setEditingProfile(profile);
                        // Route to provider-specific form based on profile.provider
                        if (profile.provider?.code === 'centerparcs') {
                            setStep('centerparcs');
                        } else {
                            // Legacy watchers or other providers use old form
                            setStep('edit');
                        }
                    }}
                />
            )}

            {/* Provider Selection Modal */}
            {step === 'select-provider' && (
                <ProviderSelection
                    onSelect={handleProviderSelect}
                    onCancel={() => setStep('list')}
                />
            )}

            {/* Center Parcs Form */}
            {step === 'centerparcs' && (
                <CenterParcsForm
                    initialData={editingProfile}
                    onSuccess={handleWatcherCreated}
                    onBack={() => setStep(editingProfile ? 'list' : 'select-provider')}
                />
            )}

            {/* Legacy Edit Form */}
            {step === 'edit' && (
                <div className="max-w-3xl mx-auto">
                    <ProfileForm
                        initialData={editingProfile}
                        onSuccess={handleWatcherCreated}
                        onCancel={() => {
                            setStep('list');
                            setEditingProfile(null);
                        }}
                    />
                </div>
            )}
        </div>
    );
}
