'use client'

import { useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

function ResetPasswordContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const [isLoading, setIsLoading] = useState(false)
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
    const [message, setMessage] = useState('')
    const [formData, setFormData] = useState({
        password: '',
        confirmPassword: ''
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        const token = searchParams.get('token')

        if (!token) {
            setStatus('error')
            setMessage('Invalid reset token')
            return
        }

        if (formData.password !== formData.confirmPassword) {
            setStatus('error')
            setMessage("Passwords don't match")
            return
        }

        setIsLoading(true)
        setStatus('idle')

        try {
            const res = await fetch('/api/proxy/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    password: formData.password
                })
            })

            const data = await res.json()

            if (res.ok) {
                setStatus('success')
                setMessage('Your password has been reset successfully!')
            } else {
                setStatus('error')
                setMessage(data.error || 'Failed to reset password')
            }
        } catch (err) {
            setStatus('error')
            setMessage('An error occurred. Please try again.')
        } finally {
            setIsLoading(false)
        }
    }

    if (status === 'success') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-hero-pattern py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-md w-full glass-card p-8 rounded-2xl text-center">
                    <div className="text-green-500 text-6xl mb-4">✓</div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Password Reset!</h2>
                    <p className="text-gray-600 mb-8">{message}</p>
                    <Button onClick={() => router.push('/auth/login')} className="w-full">
                        Go to Login
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-hero-pattern py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full glass-card p-8 rounded-2xl">
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-gray-900">Reset Password</h2>
                    <p className="mt-2 text-gray-600">Enter your new password below</p>
                </div>

                {status === 'error' && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg">
                        {message}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    <Input
                        label="New Password"
                        type="password"
                        required
                        minLength={8}
                        value={formData.password}
                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                    />

                    <Input
                        label="Confirm New Password"
                        type="password"
                        required
                        value={formData.confirmPassword}
                        onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                    />

                    <Button type="submit" className="w-full" isLoading={isLoading}>
                        Reset Password
                    </Button>
                </form>

                <div className="mt-6 text-center">
                    <Link href="/auth/login" className="text-sm font-semibold text-primary-600 hover:text-primary-500">
                        Back to Login
                    </Link>
                </div>
            </div>
        </div>
    )
}

export default function ResetPasswordPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-hero-pattern">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        }>
            <ResetPasswordContent />
        </Suspense>
    )
}
