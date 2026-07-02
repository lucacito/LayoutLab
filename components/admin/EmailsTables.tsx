type Capture = { email: string; packTitle: string | null; createdAt: Date };
type Download = { layoutTitle: string; email: string | null; ip: string | null; createdAt: Date };

const fmt = (d: Date) => d.toISOString().slice(0, 16).replace('T', ' ');

export function CapturesTable({ rows }: { rows: Capture[] }) {
  if (rows.length === 0) return <p className="text-small text-muted">No captured emails yet.</p>;
  return (
    <table className="w-full text-left text-small">
      <thead>
        <tr className="text-muted"><th className="py-2">Email</th><th>Source</th><th>Date</th></tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-border">
            <td className="py-2 text-navy">{r.email}</td>
            <td className="text-muted">{r.packTitle ?? '—'}</td>
            <td className="text-muted">{fmt(r.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function DownloadsTable({ rows }: { rows: Download[] }) {
  if (rows.length === 0) return <p className="text-small text-muted">No downloads yet.</p>;
  return (
    <table className="w-full text-left text-small">
      <thead>
        <tr className="text-muted"><th className="py-2">Layout</th><th>Downloader</th><th>IP</th><th>Date</th></tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-border">
            <td className="py-2 text-navy">{r.layoutTitle}</td>
            <td className="text-muted">{r.email ?? '—'}</td>
            <td className="text-muted">{r.ip ?? '—'}</td>
            <td className="text-muted">{fmt(r.createdAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
