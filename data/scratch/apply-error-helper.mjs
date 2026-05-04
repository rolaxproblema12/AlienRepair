// Reemplaza (err as Error).message por getErrorMessage(err) en archivos
// que ya usan ese patrón, e inserta el import si falta.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const files = [
  'src/features/orders/pages/OrderFormPage.tsx',
  'src/features/catalog/CatalogAdminPage.tsx',
  'src/features/orders/pages/OrderDetailPage.tsx',
  'src/features/parts/AddPartToOrderDialog.tsx',
  'src/features/parts/PartMovementDialog.tsx',
  'src/features/parts/PartFormPage.tsx',
  'src/features/parts/PartsListPage.tsx',
  'src/features/cash/OrderPaymentDialog.tsx',
  'src/features/cash/SaleDetailPage.tsx',
  'src/lib/printing.ts',
  'src/features/cash/NewSalePage.tsx',
  'src/features/cash/ProductPicker.tsx',
  'src/features/cash/CashCloseDialog.tsx',
  'src/features/cash/CashOpenDialog.tsx',
  'src/features/inventory/InventoryImportPage.tsx',
  'src/features/inventory/CategoriesAdminPage.tsx',
  'src/features/inventory/CategoryFormDialog.tsx',
  'src/features/inventory/ProductFormPage.tsx',
  'src/features/inventory/MovementDialog.tsx',
  'src/features/inventory/InventoryListPage.tsx',
  'src/features/inventory/BarcodeScanInput.tsx',
  'src/features/customers/CustomersPage.tsx',
  'src/features/orders/pages/ItemsListPage.tsx',
  'src/features/orders/pages/OrdersListPage.tsx',
  'src/features/auth/AuthProvider.tsx',
  'src/features/accounting/ExpenseFormDialog.tsx',
  'src/features/auth/SignupWithCodePage.tsx',
  'src/features/auth/LoginPage.tsx',
  'src/features/orders/pages/ItemDetailPage.tsx',
  'src/features/orders/pages/ItemOrderFormPage.tsx',
  'src/features/customers/CustomerDetailPage.tsx',
  'src/components/orders/OrderStatusSelect.tsx',
  'src/features/admin/UsersPage.tsx',
  'src/features/admin/CodesPage.tsx',
  'src/features/accounting/ExpensesPage.tsx',
  'src/features/customers/CustomerFormDialog.tsx',
];

const IMPORT_LINE = "import { getErrorMessage } from '@/lib/errors';";
const IMPORT_LINE_REL = "import { getErrorMessage } from '../errors';"; // for src/lib/printing.ts

let touched = 0;

for (const f of files) {
  const path = resolve(f);
  let src = readFileSync(path, 'utf8');
  const before = src;

  src = src.replace(/\(err as Error\)\.message/g, 'getErrorMessage(err)');

  if (src.includes('getErrorMessage(err)') && !src.includes('getErrorMessage }')) {
    // Insertar import después del último import top-level
    const importBlockEnd = (() => {
      const re = /^import .+;$/gm;
      let m, last = -1;
      while ((m = re.exec(src)) !== null) last = m.index + m[0].length;
      return last;
    })();
    const imp = f === 'src/lib/printing.ts' ? IMPORT_LINE_REL : IMPORT_LINE;
    src = src.slice(0, importBlockEnd) + '\n' + imp + src.slice(importBlockEnd);
  }

  if (src !== before) {
    writeFileSync(path, src, 'utf8');
    touched++;
    console.log('✓', f);
  } else {
    console.log('—', f, '(sin cambios)');
  }
}

console.log(`\n${touched}/${files.length} archivos actualizados`);
