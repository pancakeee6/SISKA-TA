export default function UsersPage() {
  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Manajemen User</h1>
        <button
          id="btn-add-user"
          className="px-4 py-2 bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)]
                     text-white text-sm font-medium rounded-[var(--radius)] transition-colors cursor-pointer"
        >
          + Tambah User
        </button>
      </div>

      {/* Table placeholder */}
      <div className="bg-[var(--color-surface)] rounded-[var(--radius)] shadow-[var(--shadow)] border border-[var(--color-border)] p-6">
        <p className="text-sm text-[var(--color-text-muted)]">
          Tabel user akan ditampilkan di sini.
        </p>
      </div>
    </div>
  )
}
