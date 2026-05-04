interface Props {
  title: string;
  folio: string;
  compact?: boolean;
  sucursalName?: string;
  sucursalAddress?: string | null;
  sucursalPhone?: string | null;
}

// Header de impresión. Si se pasa info de sucursal, la usa como nombre del
// negocio y muestra dirección/teléfono. Si no, cae en el branding genérico
// (legacy: previo a multi-sucursal). Esto mantiene compat con cualquier
// caller que aún no migró pero no debería ocurrir tras Fase 5.
export default function PrintHeader({
  title,
  folio,
  compact,
  sucursalName,
  sucursalAddress,
  sucursalPhone,
}: Props) {
  const businessName = sucursalName ?? 'AlienTechnology';
  return (
    <div className="print-brand">
      <div
        style={{
          fontWeight: 800,
          fontSize: compact ? '14pt' : '20pt',
          letterSpacing: '0.04em',
        }}
      >
        {businessName}
      </div>
      <div style={{ fontSize: compact ? '8.5pt' : '10pt', color: '#555' }}>
        Servicio técnico especializado
      </div>
      {(sucursalAddress || sucursalPhone) && (
        <div style={{ fontSize: compact ? '8pt' : '9.5pt', color: '#666', marginTop: 2 }}>
          {[sucursalAddress, sucursalPhone].filter(Boolean).join(' · ')}
        </div>
      )}
      <div style={{ marginTop: 4, fontSize: compact ? '9pt' : '11pt', fontWeight: 600 }}>
        {title} · Folio #{folio}
      </div>
    </div>
  );
}
