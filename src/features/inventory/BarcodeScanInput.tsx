import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScanBarcode } from 'lucide-react';
import { toast } from 'sonner';
import { findProductByBarcode } from './hooks';
import { useScopedSucursalId } from '@/features/sucursales/useScopedSucursalId';
import { Input } from '@/components/ui/input';
import { getErrorMessage } from '@/lib/errors';

export default function BarcodeScanInput() {
  const sucursalId = useScopedSucursalId();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(code: string) {
    const trimmed = code.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const product = await findProductByBarcode(trimmed, sucursalId);
      if (product) {
        setValue('');
        navigate(`/inventario/${product.id}`);
      } else {
        toast.error(`Sin producto con código ${trimmed}`);
        navigate(`/inventario/nuevo?barcode=${encodeURIComponent(trimmed)}`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative w-56">
      <ScanBarcode className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Código de barras..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit(value);
          }
        }}
        disabled={busy}
        className="pl-9"
      />
    </div>
  );
}
