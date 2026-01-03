import Link from 'next/link'

export default function Home() {
    return (
        <main className="flex-grow">
            {/* Hero Section */}
            <section className="relative pt-20 pb-32 overflow-hidden bg-hero-pattern">
                <div className="absolute inset-0 bg-gradient-to-b from-primary-50/50 to-white/0 pointer-events-none" />

                <div className="container relative mx-auto px-4 text-center">
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-50 border border-primary-100 text-primary-700 text-sm font-medium mb-8 animate-fade-in-up">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent-500 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-accent-500"></span>
                        </span>
                        Monitoring 1,200+ UK Holiday Parks
                    </div>

                    <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight">
                        Your UK Staycation, <br />
                        <span className="text-gradient">For Less.</span>
                    </h1>

                    <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed">
                        Never overpay for your british holiday again. We track millions of prices 24/7
                        to alert you the moment a genuine deal drops.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
                        <Link
                            href="/auth/register"
                            className="w-full sm:w-auto px-8 py-4 bg-primary-600 text-white rounded-xl font-bold shadow-lg shadow-primary-500/20 hover:bg-primary-700 hover:shadow-primary-500/30 hover:-translate-y-0.5 transition-all duration-200"
                        >
                            Start Watching - It's Free
                        </Link>
                        <Link
                            href="/auth/login"
                            className="w-full sm:w-auto px-8 py-4 bg-white text-gray-700 rounded-xl font-bold border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
                        >
                            Sign In
                        </Link>
                    </div>

                    {/* Stats/Trust */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto border-t border-gray-100 pt-12">
                        <div>
                            <div className="text-3xl font-bold text-gray-900 mb-1">24/7</div>
                            <div className="text-sm text-gray-500 font-medium">Price Monitoring</div>
                        </div>
                        <div>
                            <div className="text-3xl font-bold text-gray-900 mb-1">1.2M+</div>
                            <div className="text-sm text-gray-500 font-medium">Prices Tracked</div>
                        </div>
                        <div>
                            <div className="text-3xl font-bold text-gray-900 mb-1">~18%</div>
                            <div className="text-sm text-gray-500 font-medium">Avg. Saving</div>
                        </div>
                        <div>
                            <div className="text-3xl font-bold text-gray-900 mb-1">0%</div>
                            <div className="text-sm text-gray-500 font-medium">Spam Mails</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section className="py-24 bg-white">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold mb-4">Smart Intelligence for Smart Travellers</h2>
                        <p className="text-gray-600 max-w-2xl mx-auto">We don't just scrape prices. We analyze historical trends to tell you if a "sale" is actually a good deal.</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Feature 1 */}
                        <div className="p-8 rounded-2xl bg-secondary-50 border border-secondary-100 hover:border-primary-100 transition-colors">
                            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center text-2xl mb-6">
                                🔍
                            </div>
                            <h3 className="text-xl font-bold mb-3">Precision Monitoring</h3>
                            <p className="text-gray-600 leading-relaxed">
                                We track specific parks, dates, and accommodation types. No generic "cheap holidays" alerts - only exactly what you want.
                            </p>
                        </div>

                        {/* Feature 2 */}
                        <div className="p-8 rounded-2xl bg-secondary-50 border border-secondary-100 hover:border-primary-100 transition-colors">
                            <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center text-2xl mb-6">
                                📊
                            </div>
                            <h3 className="text-xl font-bold mb-3">Price History</h3>
                            <p className="text-gray-600 leading-relaxed">
                                See the price trend over time. Know if you're booking at the peak or catching a dip before you commit.
                            </p>
                        </div>

                        {/* Feature 3 */}
                        <div className="p-8 rounded-2xl bg-secondary-50 border border-secondary-100 hover:border-primary-100 transition-colors">
                            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center text-2xl mb-6">
                                🎯
                            </div>
                            <h3 className="text-xl font-bold mb-3">Smart Thresholds</h3>
                            <p className="text-gray-600 leading-relaxed">
                                Set your budget or let our algorithm tell you when prices hit a 30-day low. We do the math for you.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className="py-24 bg-secondary-50">
                <div className="container mx-auto px-4">
                    <div className="max-w-4xl mx-auto bg-white rounded-3xl p-8 md:p-12 shadow-xl shadow-gray-200/50">
                        <div className="grid md:grid-cols-2 gap-12 items-center">
                            <div>
                                <h2 className="text-3xl font-bold mb-6">How It Works</h2>
                                <div className="space-y-8">
                                    <div className="flex gap-4">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold">1</div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 mb-1">Create a Profile</h4>
                                            <p className="text-gray-600 text-sm">Select your preferred dates, party size, and parks.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold">2</div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 mb-1">We Watch</h4>
                                            <p className="text-gray-600 text-sm">Our bots check prices every 4 hours, building history.</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-4">
                                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold">3</div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 mb-1">You Save</h4>
                                            <p className="text-gray-600 text-sm">Get an instant email when the price drops below your target.</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="relative h-64 md:h-full min-h-[300px] bg-gray-100 rounded-2xl overflow-hidden group">
                                {/* Placeholder for UI mockup */}
                                <div className="absolute inset-0 bg-gradient-to-br from-primary-500 to-primary-600 opacity-10"></div>
                                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                                    <span className="text-6xl mb-2 block">📉</span>
                                    <span className="text-sm font-medium text-gray-500">Live Savings Visualized</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    )
}
