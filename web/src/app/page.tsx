import Link from 'next/link'

export default function Home() {
    return (
        <main className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
            <div className="container mx-auto px-4 py-16">
                <div className="max-w-4xl mx-auto text-center">
                    <h1 className="text-5xl font-bold text-gray-900 mb-6">
                        UK Staycation Price Watcher
                    </h1>
                    <p className="text-xl text-gray-600 mb-8">
                        Never overpay for your UK holiday again. We monitor prices 24/7 and alert you only when deals are genuinely good.
                    </p>

                    <div className="flex gap-4 justify-center mb-16">
                        <Link
                            href="/auth/register"
                            className="bg-primary-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-primary-700 transition"
                        >
                            Get Started
                        </Link>
                        <Link
                            href="/auth/login"
                            className="bg-white text-primary-600 px-8 py-3 rounded-lg font-semibold border-2 border-primary-600 hover:bg-primary-50 transition"
                        >
                            Sign In
                        </Link>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8 mt-16">
                        <div className="bg-white p-6 rounded-lg shadow-md">
                            <div className="text-4xl mb-4">🔍</div>
                            <h3 className="text-xl font-semibold mb-2">Price Monitoring</h3>
                            <p className="text-gray-600">
                                We track prices for Hoseasons and Haven holidays, building historical data to spot real deals.
                            </p>
                        </div>

                        <div className="bg-white p-6 rounded-lg shadow-md">
                            <div className="text-4xl mb-4">📊</div>
                            <h3 className="text-xl font-semibold mb-2">Smart Insights</h3>
                            <p className="text-gray-600">
                                Get alerted when prices hit 180-day lows or drop significantly—no spam, just value.
                            </p>
                        </div>

                        <div className="bg-white p-6 rounded-lg shadow-md">
                            <div className="text-4xl mb-4">📧</div>
                            <h3 className="text-xl font-semibold mb-2">Email Alerts</h3>
                            <p className="text-gray-600">
                                Receive timely notifications when your watched holidays become genuinely good value.
                            </p>
                        </div>
                    </div>

                    <div className="mt-16 bg-blue-50 p-8 rounded-lg">
                        <h2 className="text-2xl font-bold mb-4">How It Works</h2>
                        <ol className="text-left max-w-2xl mx-auto space-y-4">
                            <li className="flex gap-4">
                                <span className="font-bold text-primary-600">1.</span>
                                <span>Create a holiday profile with your preferences (dates, party size, location)</span>
                            </li>
                            <li className="flex gap-4">
                                <span className="font-bold text-primary-600">2.</span>
                                <span>We monitor prices every 24-72 hours, building historical context</span>
                            </li>
                            <li className="flex gap-4">
                                <span className="font-bold text-primary-600">3.</span>
                                <span>Get alerted when prices hit meaningful thresholds or new deals appear</span>
                            </li>
                            <li className="flex gap-4">
                                <span className="font-bold text-primary-600">4.</span>
                                <span>Book directly with the provider when you're ready</span>
                            </li>
                        </ol>
                    </div>
                </div>
            </div>
        </main>
    )
}
