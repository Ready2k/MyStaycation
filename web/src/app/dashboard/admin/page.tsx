'use client';

import { useState } from 'react';
import AdminGuard from '@/components/auth/AdminGuard';
import UsersTab from './UsersTab';
import DatabaseTab from './DatabaseTab';
import WatchersTab from './WatchersTab';
import SystemTab from './SystemTab';

type Tab = 'users' | 'database' | 'watchers' | 'system';

export default function AdminDashboardPage() {
    const [activeTab, setActiveTab] = useState<Tab>('users');

    const tabs: { id: Tab; label: string }[] = [
        { id: 'users', label: 'Manage Users' },
        { id: 'database', label: 'Database' },
        { id: 'watchers', label: 'All Watchers' },
        { id: 'system', label: 'System & Logs' },
    ];

    return (
        <AdminGuard>
            <div className="space-y-6">
                <div className="md:flex md:items-center md:justify-between">
                    <div className="flex-1 min-w-0">
                        <h2 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                            Admin Dashboard
                        </h2>
                    </div>
                </div>

                <div className="bg-white shadow rounded-lg">
                    <div className="border-b border-gray-200">
                        <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`${activeTab === tab.id
                                            ? 'border-primary-500 text-primary-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        }
                                    whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </nav>
                    </div>

                    <div className="p-6">
                        {activeTab === 'users' && <UsersTab />}
                        {activeTab === 'database' && <DatabaseTab />}
                        {activeTab === 'watchers' && <WatchersTab />}
                        {activeTab === 'system' && <SystemTab />}
                    </div>
                </div>
            </div>
        </AdminGuard>
    );
}
