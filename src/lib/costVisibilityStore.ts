import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useAuth } from '@/features/auth/AuthProvider';

interface CostVisibilityState {
  hidden: boolean;
  toggle: () => void;
  setHidden: (v: boolean) => void;
}

const useCostVisibilityStore = create<CostVisibilityState>()(
  persist(
    (set, get) => ({
      hidden: false,
      toggle: () => set({ hidden: !get().hidden }),
      setHidden: (v) => set({ hidden: v }),
    }),
    { name: 'alien:cost-visibility' }
  )
);

export function useCanSeeCosts() {
  const { profile } = useAuth();
  const hidden = useCostVisibilityStore((s) => s.hidden);
  const toggle = useCostVisibilityStore((s) => s.toggle);
  const isAdmin = profile?.role === 'admin';
  return {
    isAdmin,
    canSee: isAdmin && !hidden,
    hidden: isAdmin ? hidden : true,
    toggle,
  };
}
