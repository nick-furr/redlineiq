import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom'
import HomePage from './pages/HomePage'
import ProjectPage from './pages/ProjectPage'

function Header() {
  const navigate = useNavigate()
  const location = useLocation()
  const isProject = location.pathname.startsWith('/projects/')

  return (
    <header className="flex items-center justify-between px-5 h-12 border-b border-[var(--line)] bg-[var(--bg)] shrink-0 z-20">
      <Link to="/" className="flex items-center gap-2.5">
        {/* two-square logo */}
        <div className="relative w-[22px] h-[22px]">
          <div className="absolute inset-[2px] border border-[var(--fg-2)] rounded-[2px]"/>
          <div className="absolute inset-[6px] top-[8px] border border-[var(--accent)] bg-[var(--accent-f)] rounded-[1px]"/>
        </div>
        <span className="text-[13.5px] tracking-tight font-semibold">RedlineIQ</span>
      </Link>

      <button
        onClick={() => navigate(isProject ? '/' : '/')}
        className="mono text-[11px] text-[var(--fg-3)] hover:text-[var(--fg-1)] px-2 py-1"
      >
        {isProject ? '← projects' : 'new project'}
      </button>
    </header>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col h-full">
        <Header/>
        <Routes>
          <Route path="/" element={<HomePage/>}/>
          <Route path="/projects/:id" element={<ProjectPage/>}/>
        </Routes>
      </div>
    </BrowserRouter>
  )
}
