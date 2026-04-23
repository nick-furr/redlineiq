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
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0 text-[var(--fg-2)]">
          <rect x=".75" y=".75" width="16.5" height="16.5" rx="2.5" stroke="currentColor" strokeOpacity=".35" strokeWidth="1.5"/>
          <line x1="4.5" y1="6.5" x2="13.5" y2="6.5" stroke="currentColor" strokeOpacity=".35" strokeWidth="1.3" strokeLinecap="round"/>
          <line x1="4.5" y1="9.5" x2="13.5" y2="9.5" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round"/>
          <line x1="4.5" y1="12.5" x2="10" y2="12.5" stroke="currentColor" strokeOpacity=".35" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
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
