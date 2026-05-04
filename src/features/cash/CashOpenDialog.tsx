import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Wallet } from 'lucide-react';
import { useOpenSession } from './hooks';
import { openSessionSchema, type OpenSessionInput } from './schemas';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getErrorMessage } from '@/lib/errors';

export default function CashOpenDialog() {
  const open = useOpenSession();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OpenSessionInput>({
    resolver: zodResolver(openSessionSchema),
    defaultValues: { opening_amount: 0 },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      await open.mutateAsync(values);
      toast.success('Caja abierta');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  });

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary/10">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <CardTitle>Abrir caja</CardTitle>
          <CardDescription>
            Captura el monto inicial en efectivo con que arranca la sesión.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="opening_amount">Monto inicial en efectivo</Label>
              <Input
                id="opening_amount"
                type="number"
                step="0.01"
                min={0}
                autoFocus
                {...register('opening_amount', { valueAsNumber: true })}
              />
              {errors.opening_amount && (
                <p className="text-xs text-destructive">{errors.opening_amount.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={open.isPending}>
              {open.isPending ? 'Abriendo...' : 'Abrir caja'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
