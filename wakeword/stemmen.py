"""Synthetische uitspraken met de Nederlandse Piper-stemmen, als 16 kHz mono wav.

Gebruik:
  python stemmen.py --tekst "Fluistervink" --aantal 20 --uit proef/
  python stemmen.py --tekstbestand zinnen.txt --aantal 2000 --uit data/negatief_tts/

Elke uitspraak krijgt een willekeurige stem (58 sprekers in 7 modellen), tempo
en variatie, zodat het model niet één stem leert.
"""

import argparse
import random
import wave
from io import BytesIO
from pathlib import Path

import numpy as np
import soundfile as sf
from piper import PiperVoice, SynthesisConfig
from scipy.signal import resample_poly

HIER = Path(__file__).parent
DOEL_HZ = 16000


def laad_stemmen():
    stemmen = []
    for onnx in sorted((HIER / "voices").glob("*.onnx")):
        stem = PiperVoice.load(str(onnx))
        sprekers = stem.config.num_speakers or 1
        for spreker in range(sprekers):
            stemmen.append((onnx.stem, stem, spreker if sprekers > 1 else None))
    return stemmen


def spreek(stem, spreker, tekst, rnd):
    config = SynthesisConfig(
        speaker_id=spreker,
        length_scale=rnd.uniform(0.75, 1.35),  # tempo
        # Meer ruis geeft bij de MLS-stemmen gebrabbel van seconden voor één woord
        noise_scale=rnd.uniform(0.15, 0.5),  # klankvariatie
        noise_w_scale=rnd.uniform(0.15, 0.6),  # ritme
    )
    buf = BytesIO()
    with wave.open(buf, "wb") as wav:
        stem.synthesize_wav(tekst, wav, syn_config=config)
    buf.seek(0)
    geluid, hz = sf.read(buf, dtype="float32")
    return resample_poly(geluid, DOEL_HZ, hz).astype(np.float32)


def spraakduur(geluid):
    """Seconden tussen het eerste en laatste stuk boven -35 dB van de piek"""
    vak = DOEL_HZ // 100
    stukken = geluid[: len(geluid) // vak * vak].reshape(-1, vak)
    db = 20 * np.log10(np.sqrt((stukken**2).mean(1)) + 1e-9)
    aan = np.where(db > db.max() - 35)[0]
    return (aan[-1] - aan[0] + 1) / 100


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--tekst", action="append", default=[])
    p.add_argument("--tekstbestand")
    p.add_argument("--aantal", type=int, default=20)
    p.add_argument("--uit", required=True)
    p.add_argument("--zaad", type=int, default=1)
    p.add_argument("--max-spraak", type=float, help="gooi uitspraken weg met meer seconden spraak")
    a = p.parse_args()

    teksten = list(a.tekst)
    if a.tekstbestand:
        teksten += [r.strip() for r in open(a.tekstbestand, encoding="utf-8") if r.strip() and not r.startswith("#")]
    rnd = random.Random(a.zaad)
    stemmen = laad_stemmen()
    uit = Path(a.uit)
    uit.mkdir(parents=True, exist_ok=True)
    i = weg = 0
    while i < a.aantal:
        naam, stem, spreker = rnd.choice(stemmen)
        tekst = rnd.choice(teksten)
        geluid = spreek(stem, spreker, tekst, rnd)
        if a.max_spraak and spraakduur(geluid) > a.max_spraak:
            weg += 1
            continue
        label = f"{naam}-{spreker if spreker is not None else 0}"
        sf.write(uit / f"{i:05d}_{label}.wav", geluid, DOEL_HZ, subtype="PCM_16")
        i += 1
    print(f"{a.aantal} uitspraken in {uit} ({len(stemmen)} stemmen, {weg} weggegooid)")


if __name__ == "__main__":
    main()
