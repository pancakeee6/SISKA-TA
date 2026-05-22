export default function FaceManagementPage() {
  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold mb-6">Manajemen Data Wajah</h1>

      <div className="bg-[var(--color-surface)] rounded-[var(--radius)] shadow-[var(--shadow)] border border-[var(--color-border)] p-6">
        <p className="text-sm text-[var(--color-text-muted)]">
          Upload dan kelola data wajah user untuk registrasi AI face recognition.
        </p>
      </div>
    </div>
  )
}
