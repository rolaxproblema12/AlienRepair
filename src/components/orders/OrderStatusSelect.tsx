import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUpdateOrderStatus } from '@/features/orders/hooks';
import { getErrorMessage } from '@/lib/errors';
import {
  ORDER_STATUSES,
  STATUS_LABELS,
  availableStatusesFor,
  type OrderKind,
  type OrderStatus,
} from '@/features/orders/types';

interface Props {
  orderId: string;
  status: OrderStatus;
  kind?: OrderKind;
  compact?: boolean;
}

export default function OrderStatusSelect({ orderId, status, kind, compact }: Props) {
  const update = useUpdateOrderStatus();
  const options = kind ? availableStatusesFor(kind) : ORDER_STATUSES;
  return (
    <Select
      value={status}
      onValueChange={async (v) => {
        try {
          await update.mutateAsync({ id: orderId, status: v as OrderStatus });
          toast.success(`Estatus: ${STATUS_LABELS[v as OrderStatus]}`);
        } catch (err) {
          toast.error(getErrorMessage(err));
        }
      }}
    >
      <SelectTrigger className={compact ? 'h-7 w-[140px] text-xs' : 'w-[180px]'}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((s) => (
          <SelectItem key={s} value={s}>
            {STATUS_LABELS[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
