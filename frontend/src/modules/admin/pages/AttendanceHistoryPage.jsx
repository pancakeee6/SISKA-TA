export default function AttendanceHistoryPage() {
  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold mb-6">Riwayat Kehadiran</h1>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          type="date"
          className="px-3 py-2 text-sm border border-[var(--color-border)] rounded-[var(--radius)] 
                     focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
        />
        <input
          type="text"
          placeholder="Cari nama..."
          className="px-3 py-2 text-sm border border-[var(--color-border)] rounded-[var(--radius)]
                     focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)] w-64"
        />
      </div>

      {/* Table placeholder */}
      <div className="bg-[var(--color-surface)] rounded-[var(--radius)] shadow-[var(--shadow)] border border-[var(--color-border)] p-6">
        <p className="text-sm text-[var(--color-text-muted)]">
          Tabel riwayat kehadiran akan ditampilkan di sini.
        </p>
      </div>
    </div>
  )
}
