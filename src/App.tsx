import { NavLink, Route, Routes } from 'react-router-dom'
import Home from '@/pages/Home'
import About from '@/pages/About'
import Stocks from '@/pages/Stocks'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `text-sm font-medium transition-colors ${
    isActive ? 'text-white' : 'text-gray-400 hover:text-white'
  }`

function Logo() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6 text-indigo-400"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 3v18h18" />
      <path d="m7 14 4-4 3 3 5-6" />
    </svg>
  )
}

function App() {
  return (
    <div className="flex min-h-screen flex-col bg-[#0a0a0f] text-gray-100">
      <header className="sticky top-0 z-10 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <NavLink to="/" className="flex items-center gap-2" end>
            <Logo />
            <span className="text-lg font-semibold tracking-tight">
              Nama <span className="text-indigo-400">Insights</span>
            </span>
          </NavLink>

          <nav className="flex items-center gap-6">
            <NavLink to="/" className={linkClass} end>
              Home
            </NavLink>
            <NavLink to="/stocks" className={linkClass}>
              Stocks
            </NavLink>
            <NavLink to="/about" className={linkClass}>
              About
            </NavLink>
            <a
              href="#waitlist"
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
            >
              Get started
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/stocks" element={<Stocks />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </main>

      <footer className="border-t border-white/5">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-sm text-gray-500 sm:flex-row">
          <span>© 2026 Nama Insights. All rights reserved.</span>
          <span>Market data is for informational purposes only.</span>
        </div>
      </footer>
    </div>
  )
}

export default App
