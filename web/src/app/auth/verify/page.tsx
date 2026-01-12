'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'

function VerifyContent() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
    const [message, setMessage] = useState('')

    useEffect(() => {
        const token = searchParams.get('token')

        if (!token) {
            setStatus('error')
            setMessage('Missing verification token')
            return
        }

        const verifyEmail = async () => {
            try {
                const res = await fetch('/api/proxy/auth/verify-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token })
                })

                const data = await res.json()

                if (res.ok) {
                    setStatus('success')
                    setMessage('Your email has been verified successfully!')
                } else {
                    setStatus('error')
                    setMessage(data.error || 'Verification failed')
                }
            } catch (err) {
                setStatus('error')
                setMessage('An error occurred during verification')
            }
        }

        verifyEmail()
    }, [searchParams])

    return (
        <div className="min-h-screen flex items-center justify-center bg-hero-pattern py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full glass-card p-8 rounded-2xl text-center">
                {status === 'loading' && (
                    <>
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
                        <h2 className="text-2xl font-bold text-gray-900">Verifying your email...</h2>
                    </>
                )}

                {status === 'success' && (
                    <>
                        <div className="text-green-500 text-6xl mb-4">✓</div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Success!</h2>
                        <p className="text-gray-600 mb-8">{message}</p>
                        <Button onClick={() => router.push('/auth/login')} className="w-full">
                            Back to Login
                        </Button>
                    </>
                )}

                {status === 'error' && (
                    <>
                        <div className="text-red-500 text-6xl mb-4">⚠</div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Verification Failed</h2>
                        <p className="text-gray-600 mb-8">{message}</p>
                        <Link href="/auth/register">
                            <Button variant="secondary" className="w-full">
                                Try Registering Again
                            </Button>
                        </Link>
                    </>
                )}
            </div>
        </div>
    )
}

export default function VerifyPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-hero-pattern">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        }>
            <VerifyContent />
        </Suspense>
    )
}
