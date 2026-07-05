import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  ScanFace,
  Menu,
  X,
  LogOut,
  Settings,
  Moon,
  Sun,
  Calendar,
  Clock,
  Bell,
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAuthStore } from '@shared/store/authStore'
import siskaLogo from '@/assets/siska-logo.png'

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/users', icon: Users, label: 'Pengguna' },
  { to: '/admin/faces', icon: ScanFace, label: 'Manajemen Wajah' },
  { to: '/admin/attendance', icon: ClipboardList, label: 'Riwayat Absensi' },
  { to: '/admin/settings', icon: Settings, label: 'Pengaturan' },
]

// --- Greeting helper ---
function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 11) return 'Selamat pagi'
  if (hour < 15) return 'Selamat siang'
  if (hour < 18) return 'Selamat sore'
  return 'Selamat malam'
}

// --- Live Clock Component ---
function LiveClock() {
  const [time, setTime] = useState(new Date())
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const formatTime = (date) => {
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
  }

  const formatDate = (date) => {
    return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Calendar size={16} color="var(--color-text-secondary)" />
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
          {formatDate(time)}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Clock size={16} color="var(--color-text-secondary)" />
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text)' }}>
          {formatTime(time)}
        </span>
      </div>
    </div>
  )
}

export default function AdminLayout() {
  // Mobile sidebar (overlay)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { admin, logout } = useAuthStore()

  const isDashboard = location.pathname === '/admin'
  // Desktop sidebar collapsed state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  // Dark mode state
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light')
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light')
  }, [isDarkMode])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const sidebarWidth = sidebarCollapsed ? '80px' : '260px'

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f8fafc' }}>
      {/* Sidebar toggle CSS transitions */}
      <style>{`
        .sidebar-transition {
          transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                      min-width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .sidebar-collapsed .sidebar-label,
        .sidebar-collapsed .sidebar-brand-text {
          opacity: 0;
          width: 0;
          overflow: hidden;
          white-space: nowrap;
        }
        .sidebar-expanded .sidebar-label,
        .sidebar-expanded .sidebar-brand-text {
          opacity: 1;
          width: auto;
        }
        .sidebar-collapse-btn:hover {
          background: rgba(255, 255, 255, 0.15) !important;
        }
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .sidebar-nav-item,
        .sidebar-nav-item:focus,
        .sidebar-nav-item:active {
          outline: none !important;
          box-shadow: none !important;
        }
        .sidebar-nav-item:hover {
          background: transparent !important;
          color: inherit !important;
          opacity: 1 !important;
        }
        .interactive-item:hover {
          background: rgba(255, 255, 255, 0.05) !important;
          border-radius: 12px;
        }
        .logout-btn:hover {
          background: rgba(248, 113, 113, 0.1) !important;
          color: #fca5a5 !important;
        }
      `}</style>

      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Desktop (collapsible) */}
      <aside
        className={`
          sidebar-transition hidden lg:flex flex-col
          ${sidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}
        `}
        style={{
          width: sidebarWidth,
          minWidth: sidebarWidth,
          background: 'var(--color-sidebar)',
          position: 'relative',
          zIndex: 10,
          transition: 'background 0.3s ease',
        }}
      >
        {/* Hamburger Button */}
        <div style={{
          padding: sidebarCollapsed ? '16px 0 0 0' : '16px 16px 0 16px',
          display: 'flex',
          justifyContent: sidebarCollapsed ? 'center' : 'flex-end',
          position: 'relative', zIndex: 1,
        }}>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="sidebar-collapse-btn"
            title={sidebarCollapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              border: 'none',
              borderRadius: '8px',
              padding: '6px',
              cursor: 'pointer',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Menu size={16} />
          </button>
        </div>

        {/* Profile */}
        <div 
          className="interactive-item"
          style={{
            padding: sidebarCollapsed ? '16px 12px' : '20px 12px',
            margin: '0 16px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            position: 'relative', zIndex: 1,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          <div style={{
            width: sidebarCollapsed ? '36px' : '52px',
            height: sidebarCollapsed ? '36px' : '52px',
            borderRadius: '50%',
            background: '#ffffff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#264b5d', fontSize: sidebarCollapsed ? '16px' : '20px', fontWeight: 800,
            border: 'none',
            flexShrink: 0,
            textTransform: 'uppercase',
            overflow: 'hidden',
            transition: 'all 0.3s cubic-bezier(.22,1,.36,1)',
          }}>
            {admin?.avatar ? (
              <img src={admin.avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              admin?.full_name ? admin.full_name.charAt(0) : 'A'
            )}
          </div>
          {!sidebarCollapsed && (
            <div style={{ textAlign: 'center', overflow: 'hidden', width: '100%' }}>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff', margin: 0, lineHeight: 1.2, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                {admin?.full_name || 'Admin'}
              </p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="no-scrollbar" style={{ flex: 1, paddingTop: '8px', overflowY: 'auto', overflowX: 'hidden', position: 'relative', zIndex: 1 }}>
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMobileSidebarOpen(false)}
              className="sidebar-nav-item"
              title={sidebarCollapsed ? label : undefined}
              style={{ textDecoration: 'none', display: 'block' }}
            >
              {({ isActive }) => (
                <>
                  {/* Top inverse-radius spacer */}
                  {isActive && (
                    <div style={{ height: '20px', background: 'var(--color-bg-base)' }}>
                      <div style={{ width: '100%', height: '100%', background: 'var(--color-sidebar)', borderBottomRightRadius: '20px', transition: 'background 0.3s ease' }} />
                    </div>
                  )}

                  {/* Nav item */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    height: '48px',
                    marginLeft: '16px',
                    paddingLeft: sidebarCollapsed ? '12px' : '24px',
                    background: isActive ? 'var(--color-bg-base)' : 'transparent',
                    borderRadius: '30px 0 0 30px',
                    color: isActive ? 'var(--color-sidebar-text-active)' : 'var(--color-sidebar-text)',
                    transition: 'all .35s cubic-bezier(.22,1,.36,1)',
                  }}>
                    <div style={{
                      display: 'flex', justifyContent: 'center', alignItems: 'center',
                      width: '24px', flexShrink: 0
                    }}>
                      <Icon size={20} />
                    </div>
                    {!sidebarCollapsed && (
                      <span style={{
                        fontWeight: isActive ? 700 : 500,
                        fontSize: '15px',
                        marginLeft: '16px',
                        whiteSpace: 'nowrap'
                      }}>
                        {label}
                      </span>
                    )}
                  </div>

                  {/* Bottom inverse-radius spacer */}
                  {isActive && (
                    <div style={{ height: '20px', background: 'var(--color-bg-base)' }}>
                      <div style={{ width: '100%', height: '100%', background: 'var(--color-sidebar)', borderTopRightRadius: '20px', transition: 'background 0.3s ease' }} />
                    </div>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>


        {/* Logout */}
        <div style={{
          padding: '8px 0 20px 0',
          position: 'relative', zIndex: 1,
        }}>
          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              width: 'calc(100% - 16px)',
              marginLeft: '16px',
              height: '48px',
              paddingLeft: sidebarCollapsed ? '12px' : '24px',
              cursor: 'pointer',
              background: 'transparent',
              color: '#f87171',
              border: 'none',
              borderRadius: '30px 0 0 30px',
              transition: 'all .35s cubic-bezier(.22,1,.36,1)',
            }}
            className="logout-btn"
          >
            <div style={{
               display: 'flex', justifyContent: 'center', alignItems: 'center',
               width: '24px', flexShrink: 0
            }}>
              <LogOut size={20} />
            </div>
            {!sidebarCollapsed && (
              <span className="sidebar-brand-text" style={{ fontSize: '15px', fontWeight: 600, marginLeft: '16px' }}>Log Out</span>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile sidebar (overlay version) - Kept mostly same but matched colors */}
      <aside className={`lg:hidden flex flex-col fixed inset-y-0 left-0 z-50 w-[260px] shadow-xl
        transform transition-all duration-300 ease-in-out
        ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
        style={{
          background: 'var(--color-sidebar)',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
          borderTopRightRadius: '32px',
          borderBottomRightRadius: '32px',
        }}
      >
        <div style={{ padding: '24px 20px 20px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img src={siskaLogo} alt="SISKA Logo" style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#ffffff', padding: '4px' }} />
              <div>
                <h1 className="sidebar-brand-text" style={{ fontSize: '18px', fontWeight: 700, color: '#ffffff', margin: 0 }}>SISKA</h1>
                <p className="sidebar-brand-text" style={{ fontSize: '11px', color: 'var(--color-sidebar-text)', margin: 0 }}>Sistem Kehadiran AI</p>
              </div>
            </div>
            <button onClick={() => setMobileSidebarOpen(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#ffffff', borderRadius: '6px', padding: '6px' }}>
              <X size={18} />
            </button>
          </div>
        </div>
        <nav style={{ flex: 1, paddingTop: '8px', overflowY: 'auto' }}>
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setMobileSidebarOpen(false)}
              className={({ isActive }) => `sidebar-nav-item relative ${isActive ? 'cutout-active' : ''}`}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '12px 20px',
                margin: isActive ? '4px 0 4px 16px' : '4px 16px',
                fontSize: '14px', fontWeight: isActive ? 600 : 500,
                color: isActive ? 'var(--color-sidebar-text-active)' : 'var(--color-sidebar-text)',
                textDecoration: 'none',
                borderRadius: isActive ? '24px 0 0 24px' : '12px',
                background: isActive ? 'var(--color-bg-base)' : 'transparent',
                transition: 'all 0.3s ease',
              })}
            >
              <Icon size={19} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div style={{ padding: '20px' }}>
          <button onClick={handleLogout} className="logout-btn" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', width: '100%', borderRadius: '12px', background: 'rgba(255,255,255,0.1)', color: '#ffffff', border: 'none', fontWeight: 600, cursor: 'pointer', transition: 'all 0.3s' }}>
            <LogOut size={19} /> <span className="sidebar-label">Log Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative" style={{ background: 'var(--color-bg-base)', transition: 'background 0.3s ease' }}>
        
        {/* Top Navbar / Header */}
        <header style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px 32px',
          background: 'transparent',
          transition: 'all 0.3s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Mobile hamburger — visible only on small screens */}
            <div className="lg:hidden flex-shrink-0">
              <button
                onClick={() => setMobileSidebarOpen(true)}
                style={{
                  background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px',
                  padding: '6px', color: '#475569', display: 'flex', alignItems: 'center',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                }}
              >
                <Menu size={18} />
              </button>
            </div>

            {/* Greeting (Desktop) */}
            {isDashboard && (
              <div className="hidden md:block">
                <h1 style={{ fontSize: '28px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '4px', margin: 0, letterSpacing: '-0.5px' }}>
                  {getGreeting()}, {admin?.full_name?.split(' ')[0] || 'Administrator'}! 👋
                </h1>
                <p style={{ fontSize: '15px', color: 'var(--color-text-secondary)', margin: 0 }}>
                  Pantau kehadiran dan aktivitas sistem secara real-time.
                </p>
              </div>
            )}
          </div>

          {isDashboard && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>

              {/* Live Clock Pill */}
              <div style={{ 
                background: 'var(--color-bg-surface)', 
                border: '1px solid var(--color-border)', 
                borderRadius: '24px', 
                padding: '8px 20px', 
                display: 'flex', 
                alignItems: 'center',
                boxShadow: '0 2px 10px rgba(0,0,0,0.02)' 
              }}>
                <LiveClock />
              </div>

              {/* Notification Bell */}
              <button style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px',
                height: '40px',
                background: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '50%',
                cursor: 'pointer',
                color: 'var(--color-text-secondary)',
                transition: 'all 0.3s ease',
                boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
              }} className="hover-card">
                <Bell size={18} />
                <span style={{
                  position: 'absolute',
                  top: '6px',
                  right: '6px',
                  width: '8px',
                  height: '8px',
                  background: '#ef4444',
                  borderRadius: '50%',
                  border: '2px solid var(--color-bg-surface)'
                }}></span>
              </button>

              {/* Dark Mode Toggle */}
              <button 
                onClick={() => setIsDarkMode(!isDarkMode)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '40px',
                  height: '40px',
                  background: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  color: 'var(--color-text-secondary)',
                  padding: 0,
                  boxShadow: '0 2px 10px rgba(0,0,0,0.02)'
                }}
                className="hover-card"
                title={isDarkMode ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
              >
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>


            </div>
          )}
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div style={{ padding: '0 32px 32px 32px', width: '100%' }}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}