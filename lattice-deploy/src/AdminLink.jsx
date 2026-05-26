/**
 * <AdminLink /> — small top-left link to /admin.
 *
 * Subtle but always visible. Anyone clicking it lands on the /admin route,
 * where the existing auth/mod check handles authorization. Non-mods get
 * the polite "Not authorized" page; mods get signed in.
 *
 * Style: low-contrast yellow monospace, fixed top-left, ignores pointer
 * events on its outer wrapper so it doesn't accidentally cover content
 * on small screens.
 */

export default function AdminLink() {
  return (
    <div className="fixed top-3 left-3 z-40 pointer-events-none select-none">
      <a
        href="/admin"
        className="pointer-events-auto inline-block font-mono text-[10px] tracking-widest text-yellow-400/70 hover:text-yellow-400 hover:bg-yellow-400/10 px-2 py-1 border border-yellow-400/30 hover:border-yellow-400 transition-colors"
        title="Tournament mod / organizer access"
      >
        / ADMIN
      </a>
    </div>
  );
}
