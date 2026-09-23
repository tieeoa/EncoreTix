export default function LoadingSpinner({ label, invert = false }: { label?: string; invert?: boolean }) {
  return (
    <div
      className={`min-h-[50vh] flex items-center justify-center gap-2.5 text-sm font-medium ${
        invert ? 'text-blue-300' : 'text-gray-400'
      }`}
    >
      {label ? (
        <span>
          {label.replace(/\.{3,}$/, '')}
          <span className="loading-dots"><span /></span>
        </span>
      ) : null}
    </div>
  )
}