import { useState } from 'react';
import { Pencil, Plus, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { useCategories, useDeleteCategory } from './hooks';
import type { ProductCategory } from './types';
import CategoryFormDialog from './CategoryFormDialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import DeleteButton from '@/components/common/DeleteButton';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/errors';

export default function CategoriesAdminPage() {
  const categoriesQ = useCategories();
  const del = useDeleteCategory();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ProductCategory | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(c: ProductCategory) {
    setEditing(c);
    setDialogOpen(true);
  }

  async function handleDelete(c: ProductCategory) {
    try {
      await del.mutateAsync(c.id);
      toast.success(`Categoría "${c.name}" eliminada`);
    } catch (err) {
      const msg = getErrorMessage(err);
      if (msg.includes('violates foreign key')) {
        toast.error('No se puede eliminar: hay productos en esta categoría.');
      } else {
        toast.error(msg);
      }
    }
  }

  return (
    <div className="space-y-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Categorías</h1>
          <p className="text-muted-foreground">
            Categorías de productos del inventario.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva categoría
        </Button>
      </div>

      <Card>
        {categoriesQ.isLoading ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : !categoriesQ.data?.length ? (
          <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
            <Tag className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">Aún no hay categorías. Crea la primera.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Color</TableHead>
                <TableHead className="w-[120px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categoriesQ.data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    {c.color ? (
                      <span className="inline-flex items-center gap-2">
                        <span className={cn('h-4 w-4 rounded', c.color)} />
                        <span className="text-xs text-muted-foreground">{c.color}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar"
                        onClick={() => openEdit(c)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <DeleteButton
                        onConfirm={() => handleDelete(c)}
                        description={
                          <>
                            Se eliminará la categoría <strong>{c.name}</strong>.
                            Solo se puede borrar si no tiene productos asociados.
                          </>
                        }
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <CategoryFormDialog
        key={editing?.id ?? 'new'}
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) setEditing(null);
        }}
        category={editing}
      />
    </div>
  );
}
