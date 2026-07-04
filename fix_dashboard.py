import re

with open("frontend/src/modules/admin/pages/DashboardPage.jsx", "r", encoding="utf-8") as f:
    content = f.read()

new_ui = """  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '32px' }} className="animate-fade-in dashboard-main">
      
      {/* 1. HEADER BANNER */}
      <div style={{
        background: 'var(--color-bg-surface)',
        borderRadius: '24px',
        padding: '32px 40px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
        border: '1px solid var(--color-border)',
      }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '8px', margin: 0 }}>
            {getGreeting()}, {admin?.full_name?.split(' ')[0] || 'Admin'}! 👋
          </h1>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
            Pantau kehadiran, kelola data pengguna, dan lihat ringkasan hari ini.
          </p>
        </div>
        <div style={{ padding: '16px 24px', background: 'var(--color-bg-base)', borderRadius: '16px', border: '1px solid var(--color-border)' }}>
          <LiveClock />
        </div>
      </div>

      {/* 2. QUICK ACTIONS */}
      <div>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '16px', marginLeft: '8px' }}>Aksi Cepat</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
          {[
            { label: 'Tambah Pengguna', icon: UserPlus, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', path: '/admin/users' },
            { label: 'Kelola Wajah', icon: ScanFace, color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)', path: '/admin/face-management' },
            { label: 'Riwayat Absensi', icon: ClipboardList, color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)', path: '/admin/attendance' },
            { label: 'Export Laporan', icon: Download, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', path: '/admin/attendance' },
          ].map((action, idx) => (
            <div
              key={idx}
              onClick={() => navigate(action.path)}
              className="hover-card"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                background: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
                padding: '20px 24px',
                borderRadius: '20px',
                cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(0,0,0,0.02)',
                transition: 'all 0.3s ease',
              }}
            >
              <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: action.bg, color: action.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <action.icon size={22} />
              </div>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text)' }}>{action.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. KPI CARDS */}
      <div>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text)', marginBottom: '16px', marginLeft: '8px' }}>Ringkasan Hari Ini</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
          {statCards.map(({ key, label, icon: Icon, iconBg, iconColor }) => (
            <div
              key={key}
              className="hover-card"
              style={{
                background: 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '24px',
                padding: '24px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: iconBg, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={26} strokeWidth={2.5} />
                </div>
                {key === 'present' && <AttendanceDonut percentage={attendanceRate} size={52} strokeWidth={5} />}
                {key !== 'present' && (
                   <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 12px', borderRadius: '20px', background: 'var(--color-bg-base)', border: '1px solid var(--color-border)' }}>
                     {key === 'late' || key === 'absent' ? <TrendingDown size={14} color="#f59e0b" /> : <TrendingUp size={14} color="#10b981" />}
                     <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
                       {stats[key] > 0 ? (key === 'late' || key === 'absent' ? '+2' : '+5') : '0'}%
                     </span>
                   </div>
                )}
              </div>
              <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', fontWeight: 600, margin: 0, marginBottom: '8px' }}>{label}</p>
              
              {loading ? (
                <div style={{ height: '48px', width: '90px', background: 'var(--color-bg-base)', borderRadius: '8px' }} className="animate-pulse" />
              ) : (
                <p style={{ fontSize: '42px', fontWeight: 800, color: 'var(--color-text)', margin: 0, lineHeight: 1, fontFamily: 'sans-serif' }}>
                  {stats[key]}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 4. CHARTS & ACTIVITY */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1.2fr', gap: '24px' }}>
        
        {/* Analytics Chart */}
        <div style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: '24px', padding: '32px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Statistik Kehadiran</h2>
            <select style={{ padding: '8px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: 600, background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', color: 'var(--color-text)', outline: 'none', cursor: 'pointer' }}>
              <option>7 Hari Terakhir</option>
              <option>Bulan Ini</option>
            </select>
          </div>
          
          {loading ? (
             <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', height: '340px' }}>
               {[...Array(7)].map((_, i) => (
                 <div key={i} style={{ flex: 1, height: `${30 + ((i * 17) % 60)}%`, background: 'var(--color-bg-base)', borderRadius: '8px' }} className="animate-pulse" />
               ))}
             </div>
          ) : (
            <div style={{ height: '340px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorHadir" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorTerlambat" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" />
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-text-secondary)', fontWeight: 500 }} dy={15} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-text-secondary)', fontWeight: 500 }} dx={-15} allowDecimals={false} />
                  <RechartsTooltip
                    contentStyle={{ borderRadius: '16px', border: '1px solid var(--color-border)', boxShadow: '0 10px 30px rgba(0,0,0,0.08)', background: 'var(--color-bg-surface)', padding: '16px' }}
                    labelStyle={{ fontWeight: 700, color: 'var(--color-text)', marginBottom: '12px', fontSize: '14px' }}
                  />
                  <Area type="monotone" dataKey="hadir" name="Tepat Waktu" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorHadir)" activeDot={{ r: 6, strokeWidth: 0, fill: '#10b981' }} />
                  <Area type="monotone" dataKey="terlambat" name="Terlambat" stroke="#f59e0b" strokeWidth={4} fillOpacity={1} fill="url(#colorTerlambat)" activeDot={{ r: 6, strokeWidth: 0, fill: '#f59e0b' }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Recent Activity Timeline */}
        <div style={{ background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: '24px', padding: '32px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text)', margin: 0 }}>Aktivitas Terkini</h2>
            <button onClick={() => navigate('/admin/attendance')} style={{ background: 'var(--color-bg-base)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '8px 16px', color: 'var(--color-text)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }} className="hover-card">
              Lihat Semua
            </button>
          </div>
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px', position: 'relative' }}>
            {/* Vertical timeline line */}
            {displayActivities.length > 0 && (
              <div style={{ position: 'absolute', left: '20px', top: '10px', bottom: '10px', width: '2px', background: 'var(--color-border)', zIndex: 0 }}></div>
            )}
            
            {displayActivities.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: '14px', padding: '40px 0' }}>Belum ada aktivitas.</div>
            ) : (
              displayActivities.map((act, i) => (
                <div key={act.id || i} style={{ display: 'flex', gap: '16px', position: 'relative', zIndex: 1 }}>
                  {/* Avatar Bubble */}
                  <div style={{
                    width: '42px', height: '42px', borderRadius: '50%', background: 'var(--color-bg-surface)',
                    border: `2px solid ${act.statusColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: act.statusColor, fontSize: '15px', fontWeight: 700, flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
                  }}>
                    {act.user_name?.[0]?.toUpperCase() || '?'}
                  </div>
                  {/* Content */}
                  <div style={{ flex: 1, paddingTop: '2px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                      <p style={{ fontSize: '14px', color: 'var(--color-text)', fontWeight: 700, margin: 0 }}>{act.user_name}</p>
                      <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', fontWeight: 500 }}>{act.time}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{act.action}</span>
                      <div style={{ padding: '2px 8px', borderRadius: '12px', background: act.statusBg, color: act.statusColor, fontSize: '10px', fontWeight: 700 }}>
                        {act.status}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
"""

match = re.search(r"^\s*return\s*\(", content, re.MULTILINE)
if match:
    start_index = match.start()
    new_content = content[:start_index] + new_ui
    with open("frontend/src/modules/admin/pages/DashboardPage.jsx", "w", encoding="utf-8") as f:
        f.write(new_content)
    print("DashboardPage rewritten successfully!")
else:
    print("Could not find return statement in DashboardPage.jsx")
