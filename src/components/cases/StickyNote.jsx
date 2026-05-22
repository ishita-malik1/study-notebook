export default function StickyNote({ children, className = '', tilt = false }) {
  return (
    <div
      className={[
        'sticky-note rounded-sm px-4 py-3 shadow-md font-body text-gray-800 w-full',
        tilt ? 'sticky-note--tilt' : '',
        className,
      ].join(' ')}
    >
      {children}
    </div>
  );
}
