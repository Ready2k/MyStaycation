'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import api from '@/services/api';

interface User {
    role: string;
}

export default function AdminGuard({ children }: { children: React.ReactNode }) {
    const router = useRouter();

    const { data: user, isLoading } = useQuery({
        queryKey: ['user', 'me'],
        queryFn: async () => {
            const { data } = await api.get<{ user: User }>('/users/me');
            return data.user;
        },
        retry: false,
    });

    useEffect(() => {
        if (!isLoading && user?.role !== 'ADMIN') {
            router.push('/dashboard');
        }
    }, [user, isLoading, router]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    if (user?.role !== 'ADMIN') {
        return null; // Will redirect via effect
    }

    return <>{children}</>;
}
