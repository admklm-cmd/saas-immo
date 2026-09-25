/**
 * An email address that may wrap in a narrow column without being cut: it
 * breaks after its « @ » first (« sophie.marchand@ » / « example.test »), and
 * only anywhere else when one part alone is still wider than the column.
 */
export function ContactEmail({ email }: { email: string }) {
  const at = email.indexOf("@");
  if (at < 0) return <span className="[overflow-wrap:anywhere]">{email}</span>;

  return (
    <span className="[overflow-wrap:anywhere]">
      {email.slice(0, at + 1)}
      <wbr />
      {email.slice(at + 1)}
    </span>
  );
}
