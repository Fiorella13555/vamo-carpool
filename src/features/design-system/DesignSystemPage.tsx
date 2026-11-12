import { useState } from "react";
import { Bell, Car, Clock, MapPin, Shield, Star, Users } from "lucide-react";
import { Logo, LogoMark } from "../../components/Logo";
import {
  Avatar,
  BottomNav,
  Button,
  Card,
  Chip,
  EmptyState,
  GradientHero,
  Input,
  Modal,
  RatingStars,
  Skeleton,
  StatusScreen,
  Textarea,
  useToast,
} from "../../components/ui";

const PALETTE: { name: string; hex: string; light?: boolean }[] = [
  { name: "navy-50", hex: "#EEF2FB", light: true },
  { name: "navy-200", hex: "#B3C5ED", light: true },
  { name: "navy-500", hex: "#3F63AC" },
  { name: "navy-700", hex: "#1B3269" },
  { name: "navy-900", hex: "#0B2559" },
  { name: "accent-500", hex: "#3B82F6" },
  { name: "accent-700", hex: "#1D4ED8" },
  { name: "amber-500", hex: "#F59E0B" },
  { name: "success", hex: "#16A34A" },
  { name: "warning", hex: "#EA580C" },
  { name: "error", hex: "#DC2626" },
  { name: "info", hex: "#2563EB" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-b border-border-subtle py-10">
      <h2 className="text-xl font-extrabold text-text-primary">{title}</h2>
      {children}
    </section>
  );
}

function DesignSystemBody() {
  const { showToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [rating, setRating] = useState(4);

  return (
    <div className="mx-auto max-w-3xl px-4 pb-32">
      <header className="flex flex-col gap-2 py-10">
        <Logo size={40} />
        <p className="text-text-secondary">
          /design-system — solo visible en desarrollo. Todos los componentes y sus estados, tal cual la propuesta
          aprobada.
        </p>
      </header>

      <Section title="Logo">
        <div className="flex flex-wrap items-center gap-4">
          <div className="rounded-lg bg-navy-900 p-4">
            <LogoMark size={48} />
          </div>
          <div className="rounded-lg bg-bg-sunken p-4">
            <LogoMark size={48} tone="dark" />
          </div>
          <Logo size={36} />
        </div>
      </Section>

      <Section title="Paleta">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {PALETTE.map((c) => (
            <div key={c.name} className="overflow-hidden rounded-md border border-border-subtle">
              <div
                className="flex h-14 items-end p-2 font-mono text-[11px]"
                style={{ background: c.hex, color: c.light ? "#1C2A4A" : "#fff" }}
              >
                {c.hex}
              </div>
              <div className="bg-bg-surface px-2 py-1.5 text-xs font-bold">{c.name}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Degradados">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="bg-gradient-hero flex h-28 items-end rounded-lg p-3 text-xs font-bold text-white">
            gradient-hero
          </div>
          <div className="bg-gradient-soft flex h-28 items-end rounded-lg p-3 text-xs font-bold text-white">
            gradient-soft
          </div>
          <div className="bg-gradient-button flex h-28 items-end rounded-lg p-3 text-xs font-bold text-white">
            gradient-button
          </div>
        </div>
      </Section>

      <Section title="Tipografía">
        <div className="flex flex-col gap-3">
          <p className="text-[28px] font-extrabold">Título grande — display</p>
          <p className="text-2xl font-bold">Encabezado — h1</p>
          <p className="text-xl font-bold">Subtítulo — h2</p>
          <p className="text-[17px] font-semibold">Encabezado menor — h3</p>
          <p className="text-base">Texto de cuerpo — body</p>
          <p className="text-sm text-text-secondary">Texto secundario — body-sm</p>
        </div>
      </Section>

      <Section title="Botones">
        <div className="flex flex-wrap gap-3">
          <Button>Primario</Button>
          <Button variant="secondary">Secundario</Button>
          <Button variant="danger">Peligro</Button>
          <Button disabled>Deshabilitado</Button>
          <Button loading>Cargando</Button>
        </div>
      </Section>

      <Section title="Campos de formulario">
        <div className="grid max-w-md gap-4">
          <Input label="Correo" placeholder="tú@correo.com" />
          <Input label="DNI" defaultValue="1234567" error="Debe tener 8 dígitos." />
          <Textarea label="Comentario" placeholder="Opcional" rows={3} />
        </div>
      </Section>

      <Section title="Tarjeta de viaje">
        <Card className="max-w-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-bold text-text-primary">Av. Javier Prado</p>
              <p className="text-sm text-text-secondary">San Isidro → La Molina · sale en 12 min</p>
            </div>
            <Chip tone="success">3 asientos</Chip>
          </div>
          <div className="mt-3.5 flex items-center gap-2.5">
            <Avatar name="Carlos" />
            <div className="flex-1">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-text-primary">
                Carlos <RatingStars value={4.9} size={14} /> <span className="font-normal text-text-secondary">4.9</span>
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-text-secondary">
                <Users className="size-3.5" aria-hidden="true" /> 2 mujeres, 1 hombre a bordo
              </div>
            </div>
          </div>
        </Card>
      </Section>

      <Section title="Chips de estado">
        <div className="flex flex-wrap gap-2">
          <Chip tone="info" icon={<Shield className="size-3.5" aria-hidden="true" />}>
            Verificando identidad
          </Chip>
          <Chip tone="warning">En revisión</Chip>
          <Chip tone="success">Compartiendo ubicación</Chip>
        </div>
      </Section>

      <Section title="Estrellas">
        <div className="flex flex-col gap-3">
          <RatingStars value={4} aria-label="4 de 5 estrellas" />
          <div className="flex items-center gap-2">
            <RatingStars value={rating} onChange={setRating} />
            <span className="text-sm text-text-secondary">Interactiva: {rating}/5</span>
          </div>
        </div>
      </Section>

      <Section title="Modal, toast, esqueleto, estado vacío">
        <div className="flex flex-wrap items-start gap-3">
          <Button variant="secondary" onClick={() => setModalOpen(true)}>
            Abrir modal
          </Button>
          <Button variant="secondary" onClick={() => showToast("Solicitud enviada")}>
            Mostrar toast
          </Button>
        </div>
        <div className="flex max-w-xs flex-col gap-2">
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-1/3" />
        </div>
        <Card>
          <EmptyState
            icon={Car}
            title="Todavía no hay viajes"
            description="Cuando publiques uno, va a aparecer aquí."
          />
        </Card>
      </Section>

      <Section title="Estado neutro de verificación">
        <div className="overflow-hidden rounded-lg">
          <StatusScreen
            icon={Clock}
            title="Estamos verificando tu información"
            description="Te avisaremos apenas termine. Mientras tanto no puedes publicar ni solicitar viajes."
          />
        </div>
      </Section>

      <Section title="Cabecera con degradado">
        <GradientHero className="flex items-center gap-3 rounded-lg p-6">
          <MapPin className="size-6" aria-hidden="true" />
          <div>
            <p className="font-bold">Av. Javier Prado</p>
            <p className="text-sm text-white/80">Viaje en curso</p>
          </div>
        </GradientHero>
      </Section>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Confirmar solicitud">
        <p className="text-text-secondary">¿Quieres solicitar este viaje?</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setModalOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={() => setModalOpen(false)}>Confirmar</Button>
        </div>
      </Modal>

      <Section title="Barra inferior">
        <p className="text-sm text-text-secondary">
          Se fija al fondo de la pantalla (así se ve ahora mismo en esta página — es el mismo componente, no una
          imitación).
        </p>
      </Section>
    </div>
  );
}

// Gateada por import.meta.env.DEV en App.tsx -- esta ruta no existe en el
// bundle de producción.
export function DesignSystemPage() {
  return (
    <>
      <DesignSystemBody />
      <BottomNav
        items={[
          { to: "/design-system", label: "Inicio", icon: MapPin },
          { to: "/design-system#buscar", label: "Buscar", icon: Bell },
          { to: "/design-system#perfil", label: "Perfil", icon: Star },
        ]}
      />
    </>
  );
}
