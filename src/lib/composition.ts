export function formatSexComposition(men: number, women: number): string {
  if (men === 0 && women === 0) return "sin pasajeros confirmados aún";
  if (men === 0) return "solo mujeres";
  if (women === 0) return "solo hombres";
  return `${men} hombre${men === 1 ? "" : "s"}, ${women} mujer${women === 1 ? "" : "es"}`;
}
