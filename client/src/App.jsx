import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import HomePage from './pages/HomePage'
import ProjectPage from './pages/ProjectPage'

function Layout({ children }) {
  return (
    <div className="flex flex-col h-full">
      <header className="flex items-center justify-between px-5 py-3 border-b border-[#1e2128] bg-[#0c0e12] shrink-0">
        <Link to="/" className="flex items-center gap-2.5">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="2" fill="#1D9E75" opacity="0.15"/>
            <path d="M7 8h10M7 12h6M7 16h8" stroke="#1D9E75" strokeWidth="1.75" strokeLinecap="round"/>
          </svg>
          <span className="font-semibold text-[#e2e4e9] tracking-tight text-base">RedlineIQ</span>
        </Link>

        <Link
          to="/"
          className="text-xs text-[#4b5563] hover:text-[#9ca3af] transition-colors font-mono"
        >
          New project
        </Link>
      </header>

      {children}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/projects/:id" element={<ProjectPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
