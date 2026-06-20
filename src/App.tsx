import { NavLink, Route, Routes } from 'react-router-dom'
import Home from '@/pages/Home'
import About from '@/pages/About'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-indigo-600 text-white'
      : 'text-gray-300 hover:bg-gray-700 hover:text-white'
  }`

function App() {
  return (
    <div>
      <nav className="flex justify-center gap-2 p-4">
        <NavLink to="/" className={linkClass} end>
          Home
        </NavLink>
        <NavLink to="/about" className={linkClass}>
          About
        </NavLink>
      </nav>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </div>
  )
}

export default App
