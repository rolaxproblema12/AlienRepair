import { useState } from 'react';
import { Building2, MessageCircle, Tag } from 'lucide-react';
import { useCurrentSucursal } from '@/features/sucursales/hooks';
import { Card, CardContent } from '@/components/ui/card';
import { ShopDataTab } from './configuracion/ShopDataTab';
import { WhatsappTemplatesTab } from './configuracion/WhatsappTemplatesTab';
import { CatalogTab } from './configuracion/CatalogTab';
import { TabButton } from './configuracion/TabButton';

type Tab = 'shop' | 'whatsapp' | 'catalog';

export default function ConfiguracionPage() {
  const [tab, setTab] = useState<Tab>('shop');
  const { current } = useCurrentSucursal();

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground">
          Ajustes del shop, plantillas de mensajes y catálogo.
          {current && <> Sucursal actual: <strong>{current.name}</strong>.</>}
        </p>
      </div>

      {!current ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Selecciona una sucursal para configurarla.
          </CardContent>
        </Card>
      ) : (
        <>
          <div
            role="tablist"
            aria-label="Secciones de configuración"
            className="inline-flex rounded-md border border-border bg-card p-0.5"
          >
            <TabButton active={tab === 'shop'} onClick={() => setTab('shop')} icon={<Building2 className="h-3.5 w-3.5" />}>
              Datos del shop
            </TabButton>
            <TabButton active={tab === 'whatsapp'} onClick={() => setTab('whatsapp')} icon={<MessageCircle className="h-3.5 w-3.5" />}>
              Plantillas WhatsApp
            </TabButton>
            <TabButton active={tab === 'catalog'} onClick={() => setTab('catalog')} icon={<Tag className="h-3.5 w-3.5" />}>
              Catálogo
            </TabButton>
          </div>

          {tab === 'shop' && <ShopDataTab sucursalId={current.id} />}
          {tab === 'whatsapp' && <WhatsappTemplatesTab sucursalId={current.id} />}
          {tab === 'catalog' && <CatalogTab />}
        </>
      )}
    </div>
  );
}
