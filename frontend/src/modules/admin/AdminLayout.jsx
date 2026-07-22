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
  Calendar,
  Clock,
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

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 11) return 'Selamat pagi'
  if (hour < 15) return 'Selamat siang'
  if (hour < 18) return 'Selamat sore'
  return 'Selamat malam'
}

function LiveClock({ textColor = 'var(--color-text)', iconColor = 'var(--color-text-secondary)' }) {
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
        <Calendar size={16} color={iconColor} />
        <span style={{ fontSize: '13px', fontWeight: 600, color: textColor }}>
          {formatDate(time)}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Clock size={16} color={iconColor} />
        <span style={{ fontSize: '13px', fontWeight: 600, color: textColor }}>
          {formatTime(time)}
        </span>
      </div>
    </div>
  )
}

export default function AdminLayout() {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { admin, logout } = useAuthStore()

  const isDashboard = location.pathname === '/admin'
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const t = localStorage.getItem('theme')
    if (t === 'system') return window.matchMedia('(prefers-color-scheme: dark)').matches
    return t === 'dark'
  })
  const [isProfileOpen, setIsProfileOpen] = useState(false)

  useEffect(() => {
    const applyTheme = () => {
      let t = localStorage.getItem('theme')
      if (t === 'system') {
        t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
      }
      const isDark = t === 'dark'
      setIsDarkMode(isDark)
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
    }
    
    applyTheme()
    window.addEventListener('theme-change', applyTheme)
    
    // Listen for OS theme changes if set to system
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleOsChange = () => {
      if (localStorage.getItem('theme') === 'system') applyTheme()
    }
    mediaQuery.addEventListener('change', handleOsChange)
    
    return () => {
      window.removeEventListener('theme-change', applyTheme)
      mediaQuery.removeEventListener('change', handleOsChange)
    }
  }, [])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const sidebarWidth = sidebarCollapsed ? '80px' : '260px'

  return (
    <div className="flex min-h-screen" style={{ background: '#f8fafc' }}>
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
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .sidebar-nav-item, .sidebar-nav-item:focus, .sidebar-nav-item:active {
          outline: none !important; box-shadow: none !important;
        }
        .sidebar-nav-item:hover {
          background: transparent !important; color: inherit !important; opacity: 1 !important;
        }
      `}</style>

      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Desktop Sidebar */}
      <aside
        className={`sidebar-transition hidden lg:flex flex-col ${sidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}
        style={{
          width: sidebarWidth,
          minWidth: sidebarWidth,
          background: 'var(--color-sidebar)',
          height: '100vh',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          boxShadow: 'none',
          overflowX: 'hidden',
          flexShrink: 0
        }}
      >
        {/* Menu Title and Toggle Button */}
        <div style={{
          padding: sidebarCollapsed ? '20px 0 12px 0' : '20px 16px 12px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarCollapsed ? 'center' : 'space-between',
          position: 'relative', zIndex: 1,
        }}>
          {!sidebarCollapsed && (
            <span style={{
              fontSize: '11px', fontWeight: 800, color: 'var(--color-sidebar-text)',
              opacity: 0.6, letterSpacing: '1px', whiteSpace: 'nowrap'
            }}>
              MENU
            </span>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="sidebar-collapse-btn"
            title={sidebarCollapsed ? 'Buka Sidebar' : 'Tutup Sidebar'}
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
              transition: 'all 0.2s'
            }}
          >
            <Menu size={16} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="no-scrollbar" style={{ flex: 1, paddingTop: '0', overflowY: 'auto', overflowX: 'hidden' }}>
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
                        fontWeight: 500,
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

        {/* Profile & Logout (Desktop Sidebar Bottom) */}
        <div style={{ position: 'relative' }}
             onMouseEnter={() => setIsProfileOpen(true)}
             onMouseLeave={() => setIsProfileOpen(false)}>
          <div 
            onClick={() => {
              navigate('/admin/settings')
              setIsProfileOpen(false)
            }}
            style={{
              padding: sidebarCollapsed ? '16px 0' : '16px 20px 16px 40px',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              flexDirection: sidebarCollapsed ? 'column' : 'row',
              alignItems: 'center',
              gap: '12px',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }} title={admin?.full_name || 'Admin'}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%', background: 'var(--color-bg-base)',
                color: 'var(--color-sidebar)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: '14px', overflow: 'hidden', flexShrink: 0
              }}>
                {admin?.avatar ? (
                  <img src={admin.avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  admin?.full_name ? admin.full_name.charAt(0) : 'A'
                )}
              </div>
              {!sidebarCollapsed && (
                <div style={{ minWidth: 0, overflow: 'hidden' }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-sidebar-text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {admin?.full_name?.split(' ')[0] || 'Admin'}
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--color-sidebar-text)', opacity: 0.7, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {admin?.email || 'admin@siska.ac.id'}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Profile Popup Menu */}
          {isProfileOpen && (
            <div style={{
              position: 'absolute', bottom: '100%', left: sidebarCollapsed ? '16px' : '20px',
              paddingBottom: '8px', width: '200px', zIndex: 100,
            }}>
              <div style={{
                background: 'var(--color-bg-surface)', 
                border: '1px solid var(--color-border)', borderRadius: '12px', 
                boxShadow: '0 8px 30px rgba(0,0,0,0.15)', padding: '8px',
                animation: 'slideUp 0.2s ease-out'
              }}>
                <button onClick={handleLogout} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                  padding: '10px 12px', background: 'transparent', border: 'none',
                  borderRadius: '8px', color: '#ef4444', fontWeight: 600, cursor: 'pointer',
                  textAlign: 'left', transition: 'background 0.2s', fontSize: '13px'
                }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <LogOut size={16} /> Keluar (Log Out)
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile sidebar (overlay version) */}
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
              <img src={siskaLogo} alt="SISKA Logo" style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'var(--color-sidebar-text)', padding: '4px' }} />
              <div>
                <h1 className="sidebar-brand-text" style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-sidebar-text)', margin: 0 }}>SISKA</h1>
                <p className="sidebar-brand-text" style={{ fontSize: '11px', color: 'var(--color-sidebar-text)', opacity: 0.8, margin: 0 }}>Sistem Kehadiran AI</p>
              </div>
            </div>
            <button onClick={() => setMobileSidebarOpen(false)} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: 'var(--color-sidebar-text)', borderRadius: '6px', padding: '6px' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        <div style={{ padding: '16px 20px 8px 20px' }}>
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--color-sidebar-text)', opacity: 0.6, letterSpacing: '1px' }}>MENU</span>
        </div>

        <nav style={{ flex: 1, overflowY: 'auto' }}>
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink key={to} to={to} end={end} onClick={() => setMobileSidebarOpen(false)}
              className={({ isActive }) => `sidebar-nav-item relative ${isActive ? 'cutout-active' : ''}`}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: '14px',
                padding: '12px 20px',
                margin: isActive ? '4px 0 4px 16px' : '4px 16px',
                fontSize: '14px', fontWeight: 500,
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

        {/* Profile & Logout (Mobile Sidebar Bottom) */}
        <div style={{ position: 'relative' }}
             onMouseEnter={() => setIsProfileOpen(true)}
             onMouseLeave={() => setIsProfileOpen(false)}>
          <div 
            onClick={() => {
              navigate('/admin/settings')
              setMobileSidebarOpen(false)
              setIsProfileOpen(false)
            }}
            style={{
              padding: '16px 20px 16px 36px',
              borderTop: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              justifyContent: 'flex-start',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '50%', background: 'var(--color-bg-base)',
                color: 'var(--color-sidebar)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: '14px', overflow: 'hidden', flexShrink: 0
              }}>
                {admin?.avatar ? (
                  <img src={admin.avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  admin?.full_name ? admin.full_name.charAt(0) : 'A'
                )}
              </div>
              <div style={{ minWidth: 0, overflow: 'hidden' }}>
                <p style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-sidebar-text)', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {admin?.full_name?.split(' ')[0] || 'Admin'}
                </p>
                <p style={{ fontSize: '11px', color: 'var(--color-sidebar-text)', opacity: 0.7, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {admin?.email || 'admin@siska.ac.id'}
                </p>
              </div>
            </div>
          </div>
          
          {/* Mobile Profile Popup Menu */}
          {isProfileOpen && (
            <div style={{
              position: 'absolute', bottom: '100%', left: '20px',
              paddingBottom: '8px', width: '220px', zIndex: 100,
            }}>
              <div style={{
                background: 'var(--color-bg-surface)', 
                border: '1px solid var(--color-border)', borderRadius: '12px', 
                boxShadow: '0 8px 30px rgba(0,0,0,0.15)', padding: '8px',
                animation: 'slideUp 0.2s ease-out'
              }}>
                <button onClick={handleLogout} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                  padding: '10px 12px', background: 'transparent', border: 'none',
                  borderRadius: '8px', color: '#ef4444', fontWeight: 600, cursor: 'pointer',
                  textAlign: 'left', transition: 'background 0.2s', fontSize: '13px'
                }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  <LogOut size={16} /> Keluar (Log Out)
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col relative" style={{ background: 'var(--color-bg-base)', transition: 'background 0.3s ease' }}>
        
        {/* Sticky Top Bar */}
        <div style={{ 
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          padding: isDashboard ? '24px 24px 16px 24px' : '20px 24px',
          position: 'sticky', top: 0, zIndex: 40,
          background: 'var(--color-bg-base)',
          borderBottom: '1px solid var(--color-border)',
        }}>
          {/* Left Side: Greeting (Hanya pada Dashboard) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {isDashboard && (
              <div>
                <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--color-text)', margin: 0, letterSpacing: '-0.5px' }}>
                  {getGreeting()}, {admin?.full_name?.split(' ')[0] || 'Administrator'}! 👋
                </h1>
                <p style={{ fontSize: '13.5px', color: 'var(--color-text-secondary)', margin: '2px 0 0 0', fontWeight: 500 }}>
                  Pantau statistik kehadiran pegawai dan aktivitas sistem
                </p>
              </div>
            )}
          </div>

          {/* Right Side: Tools (Hanya LiveClock) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ background: 'var(--color-bg-surface)', borderRadius: '24px', padding: '6px 16px', border: '1px solid var(--color-border)', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' }} className="hidden xl:flex">
              <LiveClock textColor="var(--color-text)" iconColor="var(--color-text-secondary)" />
            </div>
          </div>
        </div>

        <main className="flex-1 overflow-auto">
          <div style={{ padding: '0 24px 24px 24px', paddingTop: isDashboard ? '24px' : '20px', width: '100%', display: 'flex', flexDirection: 'column' }}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}