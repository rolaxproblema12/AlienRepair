import { useState, type ReactNode } from 'react';
import { Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  onConfirm: () => Promise<void> | void;
  label?: string;
  description?: ReactNode;
  confirmText?: string;
  variant?: 'icon' | 'button';
  size?: 'sm' | 'icon' | 'default';
  disabled?: boolean;
  disabledReason?: string;
}

export default function DeleteButton({
  onConfirm,
  label = 'Eliminar',
  description = '¿Eliminar definitivamente? Esta acción no se puede deshacer.',
  confirmText = 'Sí, eliminar',
  variant = 'icon',
  size,
  disabled,
  disabledReason,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    try {
      setLoading(true);
      await onConfirm();
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  const trigger =
    variant === 'icon' ? (
      <Button
        variant="ghost"
        size={size ?? 'icon'}
        title={disabled ? disabledReason ?? label : label}
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    ) : (
      <Button
        variant="outline"
        size={size}
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        {label}
      </Button>
    );

  return (
    <>
      {trigger}
      <Dialog open={open} onOpenChange={(o) => !loading && setOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar eliminación</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              {confirmText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
