interface AvatarProps {
  name: string;
  size?: number;
}

// No hay fotos de perfil en la app -- siempre iniciales sobre el
// degradado del botón primario.
export function Avatar({ name, size = 40 }: AvatarProps) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-button font-extrabold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}
