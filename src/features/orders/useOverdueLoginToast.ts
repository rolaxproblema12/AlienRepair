import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/features/auth/AuthProvider';
import { useOverdueOrdersCount } from './hooks';

export function useOverdueLoginToast() {
  const { session } = useAuth();
  const overdue = useOverdueOrdersCount();
  const navigate = useNavigate();
  const shownForSession = useRef<string | null>(null);

  useEffect(() => {
    if (!session?.user?.id) {
      shownForSession.current = null;
      return;
    }
    if (overdue.isLoading) return;
    if (shownForSession.current === session.user.id) return;
    const count = overdue.data ?? 0;
    if (count > 0) {
      toast.warning(
        `Tienes ${count} ${count === 1 ? 'orden retrasada' : 'órdenes retrasadas'}`,
        {
          description: 'Revisa la lista para contactar al cliente.',
          action: {
            label: 'Ver',
            onClick: () => navigate('/retrasados'),
          },
        }
      );
    }
    shownForSession.current = session.user.id;
  }, [session?.user?.id, overdue.data, overdue.isLoading, navigate]);
}
