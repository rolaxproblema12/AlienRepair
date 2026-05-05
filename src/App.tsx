import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Toaster, toast } from 'sonner';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { queryClient } from '@/lib/queryClient';
import { idbPersister, shouldPersistQueryKey } from '@/lib/queryPersister';
import packageJson from '../package.json';
import LoginPage from '@/features/auth/LoginPage';
import SignupWithCodePage from '@/features/auth/SignupWithCodePage';
import DashboardPage from '@/features/dashboard/DashboardPage';
import CustomersPage from '@/features/customers/CustomersPage';
import CustomerDetailPage from '@/features/customers/CustomerDetailPage';
import OrdersListPage from '@/features/orders/pages/OrdersListPage';
import OrderFormPage from '@/features/orders/pages/OrderFormPage';
import OrderDetailPage from '@/features/orders/pages/OrderDetailPage';
import ItemsListPage from '@/features/orders/pages/ItemsListPage';
import ItemOrderFormPage from '@/features/orders/pages/ItemOrderFormPage';
import ItemDetailPage from '@/features/orders/pages/ItemDetailPage';
import AgendaPage from '@/features/agenda/AgendaPage';
import OverduePage from '@/features/orders/pages/OverduePage';
import AccountingPage from '@/features/accounting/AccountingPage';
import ExpensesPage from '@/features/accounting/ExpensesPage';
import PrintOrderPage from '@/features/orders/pages/PrintOrderPage';
import PrintReceiptPage from '@/features/orders/pages/PrintReceiptPage';
import CodesPage from '@/features/admin/CodesPage';
import UsersPage from '@/features/admin/UsersPage';
import AuditPage from '@/features/admin/AuditPage';
import LoginReportPage from '@/features/admin/LoginReportPage';
import InventoryListPage from '@/features/inventory/InventoryListPage';
import ProductFormPage from '@/features/inventory/ProductFormPage';
import ProductDetailPage from '@/features/inventory/ProductDetailPage';
import CategoriesAdminPage from '@/features/inventory/CategoriesAdminPage';
import InventoryImportPage from '@/features/inventory/InventoryImportPage';
import CashRegisterPage from '@/features/cash/CashRegisterPage';
import NewSalePage from '@/features/cash/NewSalePage';
import SalesHistoryPage from '@/features/cash/SalesHistoryPage';
import SaleDetailPage from '@/features/cash/SaleDetailPage';
import PrintSalePage from '@/features/cash/PrintSalePage';
import PartsListPage from '@/features/parts/PartsListPage';
import PartFormPage from '@/features/parts/PartFormPage';
import PartDetailPage from '@/features/parts/PartDetailPage';
import CatalogPage from '@/features/catalog/CatalogPage';
import CatalogAdminPage from '@/features/catalog/CatalogAdminPage';
import SucursalesAdminPage from '@/features/sucursales/SucursalesAdminPage';
import ConfiguracionPage from '@/features/admin/ConfiguracionPage';
import ReportsPage from '@/features/reports/ReportsPage';
import PrintReportPage from '@/features/reports/PrintReportPage';
import AppShell from '@/components/layout/AppShell';
import ProtectedRoute from '@/routes/ProtectedRoute';
import AdminRoute from '@/routes/AdminRoute';
import AuthGate from '@/routes/AuthGate';

// Detecta si la app levantó después de actualizarse comparando la versión
// del bundle contra la última registrada en localStorage. Cubre tanto el
// path manual ("Reiniciar y actualizar") como el silencioso de
// autoInstallOnAppQuit, que de otro modo no daría feedback al usuario.
function usePostUpdateToast() {
  useEffect(() => {
    const KEY = 'alien:last-version';
    const current = packageJson.version;
    let previous: string | null = null;
    try {
      previous = localStorage.getItem(KEY);
    } catch {
      /* localStorage no disponible — no hacemos nada */
      return;
    }
    if (previous && previous !== current) {
      toast.success(`Actualizado a v${current}`, { duration: 6_000 });
    }
    try {
      localStorage.setItem(KEY, current);
    } catch {
      /* ignore */
    }
  }, []);
}

export default function App() {
  usePostUpdateToast();
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: idbPersister,
        maxAge: 24 * 60 * 60 * 1000,
        buster: packageJson.version,
        dehydrateOptions: {
          // Excluir queries en vuelo: TanStack v5 deja una Promise en el
          // state de queries pending y IndexedDB no puede structured-clone
          // Promises, lo que tiraba DataCloneError en cada batch del cache.
          shouldDehydrateQuery: (q) =>
            q.state.status !== 'pending' && shouldPersistQueryKey(q.queryKey),
        },
      }}
    >
      <AuthProvider>
        <HashRouter>
          <Routes>
            <Route path="/login" element={<AuthGate><LoginPage /></AuthGate>} />
            <Route path="/signup-code" element={<SignupWithCodePage />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/print/order/:id" element={<PrintOrderPage />} />
              <Route path="/print/receipt/:id" element={<PrintReceiptPage />} />
              <Route path="/print/sale/:id" element={<PrintSalePage />} />
              <Route path="/print/report/:id" element={<PrintReportPage />} />

              <Route element={<AppShell />}>
                <Route path="/dashboard" element={<DashboardPage />} />

                <Route path="/clientes" element={<CustomersPage />} />
                <Route path="/clientes/:id" element={<CustomerDetailPage />} />

                <Route path="/reparaciones" element={<OrdersListPage />} />
                <Route path="/reparaciones/nueva" element={<OrderFormPage />} />
                <Route path="/reparaciones/:id" element={<OrderDetailPage />} />
                <Route path="/reparaciones/:id/editar" element={<OrderFormPage />} />

                <Route path="/encargos" element={<ItemsListPage kind="encargo" />} />
                <Route path="/encargos/nuevo" element={<ItemOrderFormPage kind="encargo" />} />
                <Route path="/encargos/:id" element={<ItemDetailPage kind="encargo" />} />
                <Route path="/encargos/:id/editar" element={<ItemOrderFormPage kind="encargo" />} />

                <Route path="/accesorios" element={<ItemsListPage kind="accesorio" />} />
                <Route path="/accesorios/nuevo" element={<ItemOrderFormPage kind="accesorio" />} />
                <Route path="/accesorios/:id" element={<ItemDetailPage kind="accesorio" />} />
                <Route path="/accesorios/:id/editar" element={<ItemOrderFormPage kind="accesorio" />} />

                <Route path="/inventario" element={<InventoryListPage />} />
                <Route path="/inventario/nuevo" element={<ProductFormPage />} />
                <Route path="/inventario/:id" element={<ProductDetailPage />} />
                <Route path="/inventario/:id/editar" element={<ProductFormPage />} />

                <Route path="/piezas" element={<PartsListPage />} />
                <Route path="/piezas/nueva" element={<PartFormPage />} />
                <Route path="/piezas/:id" element={<PartDetailPage />} />
                <Route path="/piezas/:id/editar" element={<PartFormPage />} />

                <Route path="/catalogo" element={<CatalogPage />} />

                <Route path="/caja" element={<CashRegisterPage />} />
                <Route path="/caja/venta/nueva" element={<NewSalePage />} />
                <Route path="/caja/historial" element={<SalesHistoryPage />} />
                <Route path="/caja/:id" element={<SaleDetailPage />} />

                <Route path="/agenda" element={<AgendaPage />} />
                <Route path="/retrasados" element={<OverduePage />} />
                <Route path="/reportes" element={<ReportsPage />} />

                <Route element={<AdminRoute />}>
                  <Route path="/gastos" element={<ExpensesPage />} />
                  <Route path="/contabilidad" element={<AccountingPage />} />

                  <Route path="/admin/configuracion" element={<ConfiguracionPage />} />
                  <Route path="/admin/sucursales" element={<SucursalesAdminPage />} />
                  <Route path="/admin/codes" element={<CodesPage />} />
                  <Route path="/admin/users" element={<UsersPage />} />
                  <Route path="/admin/audit" element={<AuditPage />} />
                  <Route path="/admin/categorias" element={<CategoriesAdminPage />} />
                  <Route path="/admin/inventario-import" element={<InventoryImportPage />} />
                  <Route path="/admin/catalogo" element={<CatalogAdminPage />} />
                  <Route path="/informes/login" element={<LoginReportPage />} />
                </Route>

                <Route path="/" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </HashRouter>
        <Toaster theme="dark" position="top-right" richColors />
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}
