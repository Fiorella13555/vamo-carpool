import { useState } from "react";
import { submitRating } from "./api";
import { Button, RatingStars, Textarea } from "../../components/ui";

interface RatingFormProps {
  tripId: string;
  raterId: string;
  ratedId: string;
  ratedName: string;
  onSubmitted: (stars: number) => void;
}

export function RatingForm({ tripId, raterId, ratedId, ratedName, onSubmitted }: RatingFormProps) {
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await submitRating({ tripId, raterId, ratedId, stars, comment: comment.trim() || null });
      onSubmitted(stars);
    } catch (err) {
      setError(err instanceof Error ? err.message : typeof err === "object" && err !== null && "message" in err ? String(err.message) : "Error al enviar la calificación.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form aria-label={`Calificación para ${ratedName}`} onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg bg-bg-sunken p-3.5">
      <p className="text-sm font-bold text-text-primary">Califica a {ratedName}</p>
      {error && <p role="alert" className="rounded-sm bg-error-soft px-2.5 py-2 text-xs font-medium text-error">{error}</p>}

      <RatingStars value={stars} onChange={setStars} size={28} aria-label={`Calificación: ${stars} de 5 estrellas`} />

      <Textarea
        label="Comentario (opcional)"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
      />

      <Button type="submit" loading={submitting} disabled={submitting}>
        Enviar calificación
      </Button>
    </form>
  );
}
