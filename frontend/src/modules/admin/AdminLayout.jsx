import { Outlet, NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  ScanFace,
  ChevronRight,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'
import siskaLogo from '@/assets/siska-logo.png'

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/users', icon: Users, label: 'Pengguna' },
  { to: '/admin/faces', icon: ScanFace, label: 'Manajemen Wajah' },
  { to: '/admin/attendance', icon: ClipboardList, label: 'Riwayat Absensi' },
]



export default function AdminLayout() {
  // Mobile sidebar (overlay)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  // Desktop sidebar collapsed state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const sidebarWidth = sidebarCollapsed ? '72px' : '250px'

  return (
    <div className="flex h-screen" style={{ background: '#0b1120' }}>
      {/* Sidebar toggle CSS transitions */}
      <style>{`
        .sidebar-transition {
          transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1),
                      min-width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .sidebar-content-fade {
          transition: opacity 0.2s ease, transform 0.2s ease;
        }
        .sidebar-collapsed .sidebar-label,
        .sidebar-collapsed .sidebar-brand-text,
        .sidebar-collapsed .sidebar-user-info {
          opacity: 0;
          width: 0;
          overflow: hidden;
          white-space: nowrap;
        }
        .sidebar-expanded .sidebar-label,
        .sidebar-expanded .sidebar-brand-text,
        .sidebar-expanded .sidebar-user-info {
          opacity: 1;
          width: auto;
        }
        .sidebar-collapse-btn {
          transition: all 0.2s ease;
        }
        .sidebar-collapse-btn:hover {
          background: rgba(56, 189, 248, 0.1) !important;
          color: #38bdf8 !important;
        }
      `}</style>

      {/* Mobile overlay */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
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
          background: '#0d1a2d',
          borderRight: '1px solid rgba(56, 189, 248, 0.1)',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 10,
        }}
      >
        {/* Toggle sidebar button (hamburger) — top right */}
        <div style={{
          padding: sidebarCollapsed ? '16px 10px 0 10px' : '16px 16px 0 16px',
          display: 'flex',
          justifyContent: sidebarCollapsed ? 'center' : 'flex-end',
        }}>
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="sidebar-collapse-btn"
            title={sidebarCollapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '8px',
              padding: '7px',
              cursor: 'pointer',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Menu size={17} />
          </button>
        </div>

        {/* Brand / Logo */}
        <div style={{ padding: sidebarCollapsed ? '16px 14px 20px 14px' : '16px 20px 20px 20px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            gap: '12px',
          }}>
            {/* Cat head logo image */}
            <img
              src={siskaLogo}
              alt="SISKA Logo"
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                objectFit: 'cover',
                flexShrink: 0,
              }}
            />
            <div className="sidebar-brand-text" style={{
              transition: 'opacity 0.25s ease',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}>
              <h1 style={{
                fontSize: '18px',
                fontWeight: 700,
                color: '#ffffff',
                letterSpacing: '0.5px',
                lineHeight: 1.2,
                margin: 0,
              }}>SISKA</h1>
              <p style={{
                fontSize: '11px',
                color: '#64748b',
                margin: 0,
                lineHeight: 1.3,
              }}>Sistem Kehadiran AI</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, paddingTop: '4px', overflowY: 'auto', overflowX: 'hidden' }}>
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMobileSidebarOpen(false)}
              className="sidebar-nav-item"
              title={sidebarCollapsed ? label : undefined}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: sidebarCollapsed ? '12px 0' : '12px 20px',
                margin: sidebarCollapsed
                  ? (isActive ? '4px 10px' : '2px 10px')
                  : (isActive ? '4px 14px' : '2px 14px'),
                fontSize: '14px',
                fontWeight: isActive ? 500 : 400,
                color: isActive ? '#ffffff' : '#8494a7',
                textDecoration: 'none',
                borderRadius: isActive ? '12px' : '10px',
                background: isActive
                  ? 'linear-gradient(135deg, #2563eb, #1d4ed8)'
                  : 'transparent',
                boxShadow: isActive
                  ? '0 4px 15px rgba(37, 99, 235, 0.3)'
                  : 'none',
                transition: 'all 0.2s ease',
                position: 'relative',
                justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              })}
            >
              <Icon size={19} style={{ flexShrink: 0 }} />
              <span className="sidebar-label" style={{
                transition: 'opacity 0.25s ease',
                overflow: 'hidden',
              }}>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User Footer */}
        <div style={{
          padding: sidebarCollapsed ? '12px 10px' : '16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: sidebarCollapsed ? '0' : '12px',
            padding: sidebarCollapsed ? '8px 0' : '12px 14px',
            borderRadius: '12px',
            cursor: 'pointer',
            transition: 'background 0.2s ease',
            justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
            overflow: 'hidden',
          }}
            className="sidebar-user-footer"
          >
            {/* User Avatar */}
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #4338ca, #6366f1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 600,
              flexShrink: 0,
            }}>
              A
            </div>
            <div className="sidebar-user-info" style={{
              flex: 1,
              minWidth: 0,
              transition: 'opacity 0.25s ease',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
            }}>
              <p style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#ffffff',
                margin: 0,
                lineHeight: 1.3,
              }}>Admin SISKA</p>
              <p style={{
                fontSize: '11px',
                color: '#64748b',
                margin: 0,
                lineHeight: 1.4,
              }}>admin@siska.ai</p>
            </div>
            {!sidebarCollapsed && (
              <ChevronRight size={16} style={{ color: '#64748b', flexShrink: 0 }} />
            )}
          </div>
        </div>
      </aside>

      {/* Mobile sidebar (overlay version) */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-[250px] flex flex-col lg:hidden
        transform transition-transform duration-300 ease-in-out
        ${mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}
        style={{
          background: '#0d1a2d',
          borderRight: '1px solid rgba(56, 189, 248, 0.1)',
        }}
      >
        {/* Brand / Logo */}
        <div style={{ padding: '24px 20px 20px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img
                src={siskaLogo}
                alt="SISKA Logo"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  flexShrink: 0,
                }}
              />
              <div>
                <h1 style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: '#ffffff',
                  letterSpacing: '0.5px',
                  lineHeight: 1.2,
                  margin: 0,
                }}>SISKA</h1>
                <p style={{
                  fontSize: '11px',
                  color: '#64748b',
                  margin: 0,
                  lineHeight: 1.3,
                }}>Sistem Kehadiran AI</p>
              </div>
            </div>
            <button
              onClick={() => setMobileSidebarOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '4px',
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, paddingTop: '8px', overflowY: 'auto' }}>
          {navItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setMobileSidebarOpen(false)}
              className="sidebar-nav-item"
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '14px',
                padding: '12px 20px',
                margin: isActive ? '4px 14px' : '2px 14px',
                fontSize: '14px',
                fontWeight: isActive ? 500 : 400,
                color: isActive ? '#ffffff' : '#8494a7',
                textDecoration: 'none',
                borderRadius: isActive ? '12px' : '10px',
                background: isActive
                  ? 'linear-gradient(135deg, #2563eb, #1d4ed8)'
                  : 'transparent',
                boxShadow: isActive
                  ? '0 4px 15px rgba(37, 99, 235, 0.3)'
                  : 'none',
                transition: 'all 0.2s ease',
                position: 'relative',
              })}
            >
              <Icon size={19} style={{ flexShrink: 0 }} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User Footer */}
        <div style={{
          padding: '16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 14px',
            borderRadius: '12px',
            cursor: 'pointer',
            transition: 'background 0.2s ease',
          }}
            className="sidebar-user-footer"
          >
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #4338ca, #6366f1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 600,
              flexShrink: 0,
            }}>
              A
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: '13px',
                fontWeight: 600,
                color: '#ffffff',
                margin: 0,
                lineHeight: 1.3,
              }}>Admin SISKA</p>
              <p style={{
                fontSize: '11px',
                color: '#64748b',
                margin: 0,
                lineHeight: 1.4,
              }}>admin@siska.ai</p>
            </div>
            <ChevronRight size={16} style={{ color: '#64748b', flexShrink: 0 }} />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile hamburger — visible only on small screens */}
        <div className="lg:hidden" style={{
          padding: '14px 20px 0 20px',
          flexShrink: 0,
        }}>
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="sidebar-collapse-btn"
            title="Buka menu"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: '10px',
              padding: '8px',
              cursor: 'pointer',
              color: '#8494a7',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Menu size={18} />
          </button>
        </div>

        {/* Page Content */}
        <main className="flex-1 overflow-auto" style={{ background: '#0b1120' }}>
          <div style={{ padding: '24px 28px 28px 28px', width: '100%' }}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}