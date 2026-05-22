export default function DashboardPage() {
  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Karyawan', value: '0', color: 'var(--color-primary)' },
          { label: 'Hadir Hari Ini', value: '0', color: 'var(--color-success)' },
          { label: 'Terlambat', value: '0', color: 'var(--color-warning)' },
          { label: 'Belum Absen', value: '0', color: 'var(--color-error)' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-[var(--color-surface)] rounded-[var(--radius)] p-5 shadow-[var(--shadow)]
                       border border-[var(--color-border)] hover:shadow-[var(--shadow-md)] transition-shadow"
          >
            <p className="text-sm text-[var(--color-text-secondary)] mb-1">{stat.label}</p>
            <p className="text-3xl font-bold" style={{ color: stat.color }}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* Recent Activity */}
      <div className="bg-[var(--color-surface)] rounded-[var(--radius)] shadow-[var(--shadow)] border border-[var(--color-border)] p-6">
        <h2 className="text-lg font-semibold mb-4">Aktivitas Terkini</h2>
        <p className="text-sm text-[var(--color-text-muted)]">
          Belum ada data kehadiran hari ini.
        </p>
      </div>
    </div>
  )
}
