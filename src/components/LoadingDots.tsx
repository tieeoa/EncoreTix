// Titik-titik loading animasi (memakai keyframes dot-bounce di globals.css).
// Dipakai menggantikan teks "..." statis agar semua indikator loading konsisten.
export default function LoadingDots({ className }: { className?: string }) {
  return (
    <span className={`loading-dots${className ? ` ${className}` : ''}`} aria-hidden="true">
      <span />
    </span>
  )
}
