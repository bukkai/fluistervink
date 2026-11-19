# Wake word "Fluistervink"

Trainen en meten van het wake word, los van de app. Het plan, de keuzes en de uitslagen staan in `docs/plan-wakeword.md`.

Het model is een kleine classifier op de vaste kenmerken van [openWakeWord](https://github.com/dscripka/openWakeWord) (melspectrogram en embedding, 96 getallen per 80 ms). Hij kijkt naar 1,28 s en geeft een score van 0 tot 1. Alleen die classifier trainen we zelf; in de app draaien straks drie kleine ONNX-modellen (melspectrogram, embedding, deze classifier), samen ongeveer 2,5 MB.

## Opzetten

Python 3.12 (Intel-Mac: `torch` 2.2.2 is de laatste, die wil `numpy` 1.x):

```bash
cd wakeword && python3 -m venv .venv && .venv/bin/python -m pip install -r requirements.txt
```

```bash
.venv/bin/python -c "import openwakeword.utils as u; u.download_models(['alexa'])"
```

(`download_models` haalt ook de kenmerkmodellen `melspectrogram.onnx` en `embedding_model.onnx` binnen; `alexa` is alleen omdat hij een naam wil.)

Stemmen (Piper, Nederlands en Vlaams, 58 sprekers, ~450 MB):

```bash
.venv/bin/python -m piper.download_voices --download-dir voices nl_NL-mls-medium nl_NL-pim-medium nl_NL-ronnie-medium nl_NL-alex-medium nl_BE-nathalie-medium nl_BE-rdh-medium nl_BE-flemishguy-medium
```

Gewone audio als negatief en om valse meldingen te meten (openWakeWord, Hugging Face `davidscripka/openwakeword_features`): `openwakeword_features_ACAV100M_2000_hrs_16bit.npy` (17,3 GB) als `data/oww/acav_2000h.npy`, en `validation_set_features.npy` (185 MB, 10,7 uur) als `data/oww/validation_set_features.npy`.

## Data

Alles onder `data/`, `voices/` en `modellen/` staat niet in git: de veldopnames zijn van testers.

| Map | Wat | Hoe |
| --- | --- | --- |
| `data/veld/` | veldopnames uit de testset, 16 kHz wav, `persoon__uitspraak-id.wav` | `ffmpeg` uit `testset/feedback/*/audio/` (zie hieronder) |
| `data/positief/` | 3000× synthetisch "Fluistervink" | `stemmen.py --tekst Fluistervink … --max-spraak 1.8` |
| `data/negatief_lijkt/` | 2000× wat erop lijkt (`teksten/lijkt_erop.txt`) | `stemmen.py --tekstbestand teksten/lijkt_erop.txt` |
| `data/negatief_zinnen/` | 3000× echte veldzinnen uit de testset, door Piper uitgesproken | `stemmen.py --tekstbestand data/zinnen_veld.txt` |

```bash
for f in ../testset/feedback/*/audio/*; do p=$(basename $(dirname $(dirname $f))); ffmpeg -v error -nostdin -i "$f" -ac 1 -ar 16000 -sample_fmt s16 "data/veld/${p}__$(basename $f).wav"; done
```

```bash
.venv/bin/python stemmen.py --tekst Fluistervink --tekst Fluistervink. --tekst Fluistervink! --tekst "Fluistervink," --aantal 3000 --max-spraak 1.8 --uit data/positief --zaad 1
```

```bash
.venv/bin/python stemmen.py --tekstbestand teksten/lijkt_erop.txt --aantal 2000 --max-spraak 2.5 --uit data/negatief_lijkt --zaad 2
```

```bash
.venv/bin/python stemmen.py --tekstbestand data/zinnen_veld.txt --aantal 3000 --uit data/negatief_zinnen --zaad 3
```

`data/zinnen_veld.txt` zijn de transcripten uit `testset/feedback/*.json` zonder "luistervink" (ook persoonlijk, dus niet in git).

## Trainen en meten

```bash
.venv/bin/python train.py --uit modellen/fluistervink.onnx
```

Duurt op de Intel-Mac ongeveer 15 minuten, vooral het berekenen van de kenmerken. Het script houdt apart om te meten: de stemmen `ronnie`, `flemishguy` en een vijfde van de MLS-sprekers, en de veldopnames van iedereen behalve de eigenaar plus ~30% van de eigenaar. Het meldt per drempel:

- **herkend:** deel van de aparte stemmen (in apart veldgeluid) dat boven de drempel komt;
- **vals in het veld:** meldingen per uur op de aparte veldopnames;
- **vals gewone audio:** meldingen per uur op de meetset van openWakeWord (10,7 uur spraak, muziek, geluid);
- **vals op lijkende zinnen:** deel van de aparte synthetische negatieven dat afgaat;
- de score op de drie echte opnames waarin "Fluistervink" (of "luistervink") gezegd wordt.

Naast het model komt een `.json` met dezelfde uitslag.
