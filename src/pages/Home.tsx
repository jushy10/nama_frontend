import type { ReactNode } from 'react'

type Feature = {
  title: string
  description: string
  icon: ReactNode
}

const features: Feature[] = [
  {
    title: 'Real-time market data',
    description:
      'Live prices, volume, and the day’s biggest movers across thousands of equities — refreshed by the second.',
    icon: (
      <path d="M3 3v18h18M7 14l4-4 3 3 5-6" />
    ),
  },
  {
    title: 'AI-powered analysis',
    description:
      'Plain-English summaries of earnings, filings, and sentiment so you understand what’s moving and why.',
    icon: (
      <path d="M12 3a4 4 0 0 0-4 4 4 4 0 0 0-2 7 4 4 0 0 0 6 5 4 4 0 0 0 6-5 4 4 0 0 0-2-7 4 4 0 0 0-4-4ZM12 8v8M9 12h6" />
    ),
  },
  {
    title: 'Portfolio tracking',
    description:
      'Connect your holdings and get personalized alerts the moment something needs your attention.',
    icon: (
      <path d="M3 3v18h18M18 9l-5 5-3-3-4 4" />
    ),
  },
]

const stats = [
  { value: '8,000+', label: 'Tickers covered' },
  { value: '60s', label: 'Data refresh' },
  { value: '24/7', label: 'Market monitoring' },
]

function FeatureCard({ title, description, icon }: Feature) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6 transition-colors hover:border-indigo-500/40">
      <div className="mb-4 inline-flex rounded-lg bg-indigo-500/10 p-2.5">
        <svg
          viewBox="0 0 24 24"
          className="h-6 w-6 text-indigo-400"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {icon}
        </svg>
      </div>
      <h3 className="mb-2 text-lg font-semibold text-white">{title}</h3>
      <p className="text-sm leading-relaxed text-gray-400">{description}</p>
    </div>
  )
}

function SampleCard() {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-gradient-to-b from-white/10 to-white/[0.02] p-6 shadow-2xl shadow-indigo-950/40">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-lg font-semibold text-white">NVDA</p>
          <p className="text-xs text-gray-400">NVIDIA Corp</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-white">$128.40</p>
          <p className="text-xs font-medium text-emerald-400">+2.41%</p>
        </div>
      </div>

      <svg
        viewBox="0 0 300 80"
        className="mt-5 h-20 w-full"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <polyline
          points="0,60 40,52 80,58 120,40 160,44 200,28 240,30 300,12"
          fill="none"
          stroke="#34d399"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      <div className="mt-5 rounded-lg border border-indigo-500/20 bg-indigo-500/10 p-3">
        <p className="text-xs font-medium uppercase tracking-wide text-indigo-300">
          AI Insight
        </p>
        <p className="mt-1 text-sm text-gray-200">
          Momentum stays strong into earnings, with rising volume and improving
          sentiment across analyst notes.
        </p>
      </div>
    </div>
  )
}

function Home() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[40rem] -translate-x-1/2 rounded-full bg-indigo-600/20 blur-3xl"
          aria-hidden="true"
        />
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-2 lg:py-28">
          <div>
            <span className="inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300">
              Now in early access
            </span>
            <h1 className="mt-5 text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Make smarter stock decisions, faster.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-gray-400">
              Nama Insights turns raw market data into clear, AI-powered
              analysis — so you always know what’s moving and why, without the
              noise.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#waitlist"
                className="rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
              >
                Start for free
              </a>
              <a
                href="#features"
                className="rounded-md border border-white/15 px-5 py-2.5 text-sm font-semibold text-gray-200 transition-colors hover:bg-white/5"
              >
                See how it works
              </a>
            </div>
          </div>

          <div className="flex justify-center lg:justify-end">
            <SampleCard />
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-white/5 bg-white/[0.02]">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 py-10 sm:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-3xl font-bold text-white">{stat.value}</p>
              <p className="mt-1 text-sm text-gray-400">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white">
            Everything you need to stay ahead
          </h2>
          <p className="mt-4 text-gray-400">
            Built for investors who want signal, not spreadsheets.
          </p>
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {features.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </section>

      {/* CTA */}
      <section id="waitlist" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-600/20 to-purple-600/10 px-8 py-14 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white">
            Ready to see the market more clearly?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-gray-300">
            Join the early access list and be the first to try Nama Insights.
          </p>
          <a
            href="#"
            className="mt-8 inline-flex rounded-md bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500"
          >
            Get early access
          </a>
        </div>
      </section>
    </>
  )
}

export default Home
