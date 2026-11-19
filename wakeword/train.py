"""Train een klein wake-word-model "Fluistervink" op de kenmerken van openWakeWord.

De kenmerken (melspectrogram en embedding, 96 getallen per 80 ms) komen uit de
vaste modellen van openWakeWord; alleen de kleine classifier erop trainen we
zelf. Hij kijkt naar 16 stappen (1,28 s) en zegt hoe zeker het wake word
net is uitgesproken.

Data (zie README.md):
  data/positief/          synthetisch "Fluistervink" (stemmen.py)
  data/negatief_lijkt/    synthetisch: lijkt erop (luistervink, vink, fluisteren)
  data/negatief_zinnen/   synthetisch: echte veldzinnen uit de testset
  data/veld/              echte veldopnames (persoon__id.wav), achtergrond en negatief
  data/oww/acav_2000h.npy kenmerken van ~2000 uur gewone audio (openWakeWord), negatief
  data/oww/validation_set_features.npy  ~11 uur gewone audio, om valse meldingen te meten

Apart gehouden om te meten: een deel van de stemmen en van de veldopnames
(andere personen dan de eigenaar, en ~30% van de eigenaar).

Gebruik: python train.py [--epochs 40] [--uit modellen/fluistervink.onnx]
"""

import argparse
import hashlib
import json
import random
import time
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
from openwakeword.utils import AudioFeatures
from scipy.signal import resample_poly

HIER = Path(__file__).parent
HZ = 16000
VENSTER = 2 * HZ  # 2 s audio → 16 embeddings
STAPPEN = 16

# Veldopnames waarin "Fluistervink" (of "luistervink") echt gezegd wordt:
# geen negatief, wel meten.
ECHT_GEZEGD = {
    "772e66d9-1acb-49dc-86e1-0cee4aea91d8",  # "Feedback. … Fluistervink dus naar de achtergrond …"
    "6e233c74-a99d-4634-bf93-0871395e7e77",  # "Fluistervink."
    "4aa0bfd3-c309-45cf-95b6-72f8fb1dffc7",  # "… een kraai en een luistervink."
}


def apart_stem(pad: Path) -> bool:
    """Stemmen die we niet trainen maar alleen meten"""
    label = pad.stem.split("_", 1)[1]
    if "ronnie" in label or "flemishguy" in label:
        return True
    if "mls" in label:
        return int(label.rsplit("-", 1)[1]) % 5 == 0
    return False


def apart_veld(pad: Path) -> bool:
    persoon, uid = pad.stem.split("__")
    if persoon != "eigenaar":
        return True
    return int(hashlib.md5(uid.encode()).hexdigest(), 16) % 10 < 3


def lees(pad: Path) -> np.ndarray:
    x, hz = sf.read(pad, dtype="float32")
    assert hz == HZ, pad
    return x


def db(x):
    return 10 * np.log10((x**2).mean() + 1e-10)


class Mixer:
    """Legt een uitspraak in een venster van 2 s over veldgeluid, met wat de telefoon ervan maakt"""

    def __init__(self, achtergronden, rnd):
        self.achtergronden = achtergronden
        self.rnd = rnd

    def achtergrond(self, n):
        r = self.rnd
        if not self.achtergronden or r.random() < 0.15:
            return np.zeros(n, np.float32)
        bron = r.choice(self.achtergronden)
        if len(bron) < n:
            bron = np.tile(bron, n // len(bron) + 1)
        start = r.randrange(len(bron) - n + 1)
        return bron[start : start + n].copy()

    def telefoon(self, x):
        r = self.rnd
        if r.random() < 0.25:  # Bluetooth-microfoon: 8 kHz
            x = resample_poly(resample_poly(x, 1, 2), 2, 1)[: len(x)]
        return x

    def maak(self, spraak, eind=None):
        """Venster van 2 s; de spraak eindigt op `eind` samples (standaard willekeurig 1,6–1,95 s)"""
        r = self.rnd
        spraak = spraak[-VENSTER:]
        if eind is None:
            eind = r.randint(int(1.6 * HZ), int(1.95 * HZ))
        eind = max(eind, len(spraak))
        venster = np.zeros(VENSTER, np.float32)
        venster[eind - len(spraak) : eind] = spraak
        achter = self.achtergrond(VENSTER)
        if achter.any():
            snr = r.uniform(0, 25)
            achter *= 10 ** ((db(spraak) - db(achter) - snr) / 20)
        x = venster + achter + np.float32(r.uniform(0, 0.002)) * np.random.randn(VENSTER).astype(np.float32)
        x = self.telefoon(x)
        x *= 10 ** (r.uniform(-25, 0) / 20) / (np.abs(x).max() + 1e-6)
        return x

    def knip(self, x):
        """Een willekeurig stuk van 2 s (aangevuld als het korter is)"""
        if len(x) <= VENSTER:
            return self.maak(x, eind=self.rnd.randint(len(x), VENSTER))
        start = self.rnd.randrange(len(x) - VENSTER + 1)
        return self.maak(x[start : start + VENSTER], eind=VENSTER)


def naar_int16(vensters):
    return (np.clip(np.stack(vensters), -1, 1) * 32767).astype(np.int16)


def kenmerken(af, vensters, label):
    t = time.time()
    e = af.embed_clips(naar_int16(vensters), batch_size=128, ncpu=4)
    print(f"  {label}: {len(vensters)} vensters → {e.shape} in {time.time() - t:.0f} s")
    return e[:, -STAPPEN:, :].astype(np.float32)


def doorlopend(af, x):
    """Kenmerken van een hele opname: (stappen, 96)"""
    x = np.concatenate([np.zeros(HZ // 2, np.float32), x, np.zeros(HZ // 2, np.float32)])
    return af.embed_clips(naar_int16([x]), batch_size=1, ncpu=1)[0].astype(np.float32)


class Model(torch.nn.Module):
    def __init__(self, breed=64):
        super().__init__()
        self.net = torch.nn.Sequential(
            torch.nn.Flatten(),
            torch.nn.Dropout(0.2),
            torch.nn.Linear(STAPPEN * 96, breed),
            torch.nn.LayerNorm(breed),
            torch.nn.ReLU(),
            torch.nn.Dropout(0.2),
            torch.nn.Linear(breed, breed),
            torch.nn.LayerNorm(breed),
            torch.nn.ReLU(),
            torch.nn.Linear(breed, 1),
            torch.nn.Sigmoid(),
        )

    def forward(self, x):
        return self.net(x)


def scores(model, reeks):
    """Score per stap voor een doorlopende reeks kenmerken"""
    if len(reeks) < STAPPEN:
        return np.zeros(0)
    vensters = np.stack([reeks[i - STAPPEN : i] for i in range(STAPPEN, len(reeks) + 1)])
    with torch.no_grad():
        return model(torch.from_numpy(vensters)).numpy()[:, 0]


def meldingen(s, drempel, rust=12):
    """Aantal keer boven de drempel, met daarna 12 stappen (~1 s) rust"""
    n, i = 0, 0
    while i < len(s):
        if s[i] >= drempel:
            n += 1
            i += rust
        else:
            i += 1
    return n


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--epochs", type=int, default=30)
    p.add_argument("--acav", type=int, default=1_000_000, help="aantal vensters uit de 2000 uur")
    p.add_argument("--uit", default="modellen/fluistervink.onnx")
    p.add_argument("--zaad", type=int, default=7)
    p.add_argument("--breed", type=int, default=64, help="neuronen per laag")
    p.add_argument("--varianten", type=int, default=2, help="mengsels per positief")
    a = p.parse_args()
    rnd = random.Random(a.zaad)
    np.random.seed(a.zaad)
    torch.manual_seed(a.zaad)

    data = HIER / "data"
    veld = sorted((data / "veld").glob("*.wav"))
    veld_train = [v for v in veld if not apart_veld(v) and v.stem.split("__")[1] not in ECHT_GEZEGD]
    veld_apart = [v for v in veld if apart_veld(v) and v.stem.split("__")[1] not in ECHT_GEZEGD]
    echt = [v for v in veld if v.stem.split("__")[1] in ECHT_GEZEGD]

    pos = sorted(data.glob("positief*/*.wav"))
    pos_train = [f for f in pos if not apart_stem(f)]
    pos_apart = [f for f in pos if apart_stem(f)]
    lijkt = sorted((data / "negatief_lijkt").glob("*.wav"))
    neg_tts = lijkt + sorted((data / "negatief_zinnen").glob("*.wav"))
    neg_train = [f for f in neg_tts if not apart_stem(f)]
    neg_apart = [f for f in neg_tts if apart_stem(f)]
    print(
        f"positief {len(pos_train)} (+{len(pos_apart)} apart), negatief tts {len(neg_train)} (+{len(neg_apart)}), "
        f"veld {len(veld_train)} (+{len(veld_apart)} apart), echt gezegd {len(echt)}"
    )

    achter_train = [lees(v) for v in veld_train]
    achter_apart = [lees(v) for v in veld_apart]
    mix = Mixer(achter_train, rnd)
    af = AudioFeatures(ncpu=4)

    print("Kenmerken berekenen")
    pos_v, neg_v = [], []
    for f in pos_train:
        x = lees(f)
        for _ in range(a.varianten):
            pos_v.append(mix.maak(x))
        # Alleen het begin ("Fluister…") is géén wake word: niet te vroeg afgaan
        neg_v.append(mix.maak(x[: int(len(x) * rnd.uniform(0.4, 0.7))]))
        # En alleen het eind ("…vink") ook niet
        neg_v.append(mix.maak(x[int(len(x) * rnd.uniform(0.45, 0.65)) :]))
    for f in neg_train:
        neg_v.append(mix.knip(lees(f)))
    for x in achter_train:  # veldgeluid zelf, in stukken van 2 s met 1 s overlap
        for start in range(0, max(1, len(x) - VENSTER + 1), HZ):
            stuk = x[start : start + VENSTER]
            neg_v.append(mix.maak(stuk, eind=VENSTER) if len(stuk) == VENSTER else mix.knip(stuk))
    X_pos = kenmerken(af, pos_v, "positief")
    X_neg = kenmerken(af, neg_v, "negatief")

    X = torch.from_numpy(np.concatenate([X_pos, X_neg]))
    y = torch.cat([torch.ones(len(X_pos)), torch.zeros(len(X_neg))])
    gewicht = torch.where(y == 1, 1.0, 3.0)  # een valse melding is erger dan een gemiste

    # Gewone audio van openWakeWord: (vensters, 16, 96), willekeurig deel in het geheugen
    acav_pad = data / "oww" / "acav_2000h.npy"
    if acav_pad.exists() and a.acav:
        alles = np.load(acav_pad, mmap_mode="r")
        keus = np.sort(np.random.choice(len(alles), min(a.acav, len(alles)), replace=False))
        t = time.time()
        acav = torch.from_numpy(np.ascontiguousarray(alles[keus]))
        print(f"  gewone audio: {len(acav)} van {len(alles)} vensters ({acav.dtype}) in {time.time() - t:.0f} s")
    else:
        acav = None
        print("  geen gewone audio (data/oww/acav_2000h.npy)")

    model = Model(a.breed)
    opt = torch.optim.AdamW(model.parameters(), lr=1e-3, weight_decay=1e-3)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, a.epochs)
    for epoch in range(a.epochs):
        model.train()
        volgorde = torch.randperm(len(X))
        totaal = 0.0
        for i in range(0, len(X), 256):
            idx = volgorde[i : i + 256]
            xb, yb, wb = X[idx], y[idx], gewicht[idx]
            if acav is not None:
                extra = acav[torch.randint(len(acav), (768,))].float()
                xb = torch.cat([xb, extra])
                yb = torch.cat([yb, torch.zeros(len(extra))])
                wb = torch.cat([wb, torch.ones(len(extra))])
            uit = model(xb)[:, 0]
            verlies = torch.nn.functional.binary_cross_entropy(uit, yb, weight=wb)
            opt.zero_grad()
            verlies.backward()
            opt.step()
            totaal += verlies.item() * len(idx)
        sched.step()
        if epoch % 5 == 4 or epoch == a.epochs - 1:
            print(f"  epoch {epoch + 1}: verlies {totaal / len(X):.4f}")
    model.eval()

    print("Meten op wat apart is gehouden")
    uren = sum(len(x) for x in achter_apart) / HZ / 3600
    veld_scores = [scores(model, doorlopend(af, x)) for x in achter_apart]
    # Aparte stemmen, in apart veldgeluid, met een halve seconde stilte erna
    mix_apart = Mixer(achter_apart, random.Random(11))
    pos_scores = []
    for f in pos_apart:
        x = mix_apart.maak(lees(f), eind=int(1.5 * HZ))
        pos_scores.append(scores(model, doorlopend(af, x)).max())
    pos_scores = np.array(pos_scores)
    neg_tts_max = np.array([scores(model, doorlopend(af, mix_apart.knip(lees(f)))).max() for f in neg_apart])
    is_lijkt = np.array([f in set(lijkt) for f in neg_apart])

    meet_pad = data / "oww" / "validation_set_features.npy"
    meet_scores, meet_uren = None, 0.0
    if meet_pad.exists():
        meet = np.load(meet_pad).astype(np.float32)
        meet_uren = len(meet) * 1280 / HZ / 3600  # één stap = 1280 samples (80 ms)
        meet_scores = scores(model, meet)
        print(f"  meetset gewone audio: {meet_uren:.1f} uur")

    uitslag = {"veld_uren": round(uren, 2), "meet_uren": round(meet_uren, 1), "drempels": {}}
    print(f"  {len(achter_apart)} veldopnames ({uren:.2f} uur), {len(pos_apart)} aparte stemmen, {len(neg_apart)} aparte negatieven")
    for d in [0.5, 0.7, 0.8, 0.9, 0.95, 0.98]:
        fp = sum(meldingen(s, d) for s in veld_scores)
        r = {
            "herkend": round(float((pos_scores >= d).mean()), 3),
            "vals_veld": fp,
            "vals_per_uur": round(fp / uren, 2),
            "vals_lijkt": round(float((neg_tts_max[is_lijkt] >= d).mean()), 4),
            "vals_zinnen": round(float((neg_tts_max[~is_lijkt] >= d).mean()), 4),
        }
        if meet_scores is not None:
            r["vals_gewoon_per_uur"] = round(meldingen(meet_scores, d) / meet_uren, 2)
        uitslag["drempels"][d] = r
        print(f"  drempel {d}: herkend {r['herkend']:.1%}, vals in het veld {fp} ({r['vals_per_uur']}/uur), "
              f"vals op lijkende woorden {r['vals_lijkt']:.1%}, op veldzinnen {r['vals_zinnen']:.1%}, vals gewone audio {r.get('vals_gewoon_per_uur', '-')}/uur")
    uitslag["echt"] = {}
    for v in echt:
        s = scores(model, doorlopend(af, lees(v)))
        uitslag["echt"][v.stem] = round(float(s.max()), 3)
        print(f"  echt gezegd {v.stem}: hoogste score {s.max():.3f}")

    uit = HIER / a.uit
    uit.parent.mkdir(parents=True, exist_ok=True)
    torch.onnx.export(model, torch.zeros(1, STAPPEN, 96), uit, input_names=["kenmerken"], output_names=["score"],
                      dynamic_axes={"kenmerken": {0: "n"}, "score": {0: "n"}}, opset_version=13)
    uit.with_suffix(".json").write_text(json.dumps(uitslag, indent=2))
    print(f"Model: {uit}")


if __name__ == "__main__":
    main()
