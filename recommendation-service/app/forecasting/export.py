"""Guardar un resultado REAL del modelo para la vista sin backend Python."""
import json
from pathlib import Path

from .router import forecast, metadata, period, bundle


def main():
    day, _ = period(bundle()["metadata"])
    # Pasar hour=None expresamente: fuera de FastAPI el valor por defecto
    # de Query es metadato de validación, no un valor de consulta.
    payload = {"metadata": metadata(), "forecast": forecast(day, hour=None)}
    path = Path(__file__).resolve().parents[3] / "public" / "forecast-example.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")
    print(f"Ejemplo del modelo → {path}")


if __name__ == "__main__":
    main()
