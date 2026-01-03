'use client';

import { useState } from 'react';
import { ProfileList } from '@/components/ProfileList';
import { ProfileForm } from '@/components/ProfileForm';

export default function DashboardPage() {
    const [view, setView] = useState<'list' | 'create' | 'edit'>('list');
    const [editingProfile, setEditingProfile] = useState<any>(null);

    return (
        <div className="px-4 py-6 sm:px-0">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Your Holiday Watchers</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Manage your holiday preferences and get deal alerts.
                    </p>
                </div>
                {view === 'list' && (
                    <button
                        onClick={() => setView('create')}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                        + New Watcher
                    </button>
                )}
            </div>

            {view === 'list' && (
                <ProfileList
                    onEdit={(profile) => {
                        setEditingProfile(profile);
                        setView('edit');
                    }}
                />
            )}

            {(view === 'create' || view === 'edit') && (
                <div className="max-w-3xl mx-auto">
                    <ProfileForm
                        initialData={view === 'edit' ? editingProfile : undefined}
                        onSuccess={() => {
                            setView('list');
                            setEditingProfile(null);
                        }}
                        onCancel={() => {
                            setView('list');
                            setEditingProfile(null);
                        }}
                    />
                </div>
            )}
        </div>
    );
}
