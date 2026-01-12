'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

export default function RegisterPage() {
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState('')
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: ''
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setIsLoading(true)

        if (formData.password !== formData.confirmPassword) {
            setError("Passwords don't match")
            setIsLoading(false)
            return
        }

        try {
            // Use proxy path to leverage server-side rewrite to internal API
            const res = await fetch('/api/proxy/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: formData.email,
                    password: formData.password
                })
            })

            const data = await res.json()

            if (!res.ok) {
                throw new Error(data.message || 'Registration failed')
            }

            // Success - redirect to login
            router.push('/auth/login?registered=true')
        } catch (err: any) {
            setError(err.message)
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-hero-pattern py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full glass-card p-8 rounded-2xl">
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-gray-900">Start Saving Today</h2>
                    <p className="mt-2 text-gray-600">Create your free account to track prices</p>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <Input
                        label="Email address"
                        type="email"
                        required
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                    />

                    <Input
                        label="Password"
                        type="password"
                        required
                        minLength={8}
                        value={formData.password}
                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                    />

                    <Input
                        label="Confirm Password"
                        type="password"
                        required
                        value={formData.confirmPassword}
                        onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                    />

                    <Button type="submit" className="w-full" isLoading={isLoading}>
                        Create Account
                    </Button>
                </form>

                <div className="mt-6 text-center text-sm text-gray-600">
                    Already have an account?{' '}
                    <Link href="/auth/login" className="font-semibold text-primary-600 hover:text-primary-500">
                        Sign in
                    </Link>
                </div>
            </div>
        </div>
    )
}
