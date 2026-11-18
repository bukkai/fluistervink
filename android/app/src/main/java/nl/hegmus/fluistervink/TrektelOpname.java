package nl.hegmus.fluistervink;

import android.annotation.SuppressLint;
import android.content.Context;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioRecord;
import android.media.AudioRecordingConfiguration;
import android.media.MediaRecorder;
import android.os.Build;
import android.os.Handler;
import android.util.Log;
import com.getcapacitor.JSObject;
import java.io.File;
import java.io.IOException;
import java.util.List;
import java.util.function.BooleanSupplier;

/**
 * Trektelling in de service (proef scherm uit, docs/plan-trektelmodus.md):
 * één microfoon die blijft lopen, geknipt in stukken zoals de webcode dat
 * doet (Knipper, dezelfde regels als trektel.ts). Elk stuk wordt een eigen
 * .m4a (AacBestand). Het volgende stuk begint met het eerstvolgende blokje
 * samples, dus geen gat en geen overlap.
 *
 * Waarom hier en niet in de webcode: met het scherm uit vertraagt de WebView
 * zijn klokjes (setInterval), en dan meet de webcode het geluid niet meer
 * elke 100 ms. De opnamethread hier leest gewoon door; zolang de microfoon
 * opneemt houdt Android de telefoon wakker (geen eigen wakelock nodig).
 *
 * Microfoon delen (stap 4 van docs/roadmap-android.md): wil een andere app de
 * microfoon (bellen, Merlin), dan geeft Android die app het geluid en ons
 * stilte (vanaf Android 10). Dat zien we aan AudioRecordingCallback
 * (`isClientSilenced`, Android 10+) of aan een seconde lang alleen nullen.
 * Dan pauzeert de telling: het lopende stuk gaat weg, er komt geen nieuw tot
 * het geluid terug is.
 */
final class TrektelOpname {

    private static final String TAG = "TrektelOpname";
    static final long FRAME_MS = 100;
    /** Zo lang alleen nullen = de microfoon is bij een andere app */
    private static final long NULLEN_MS = 1_000;

    interface Uitvoer {
        /** Een nieuw stuk begint (de webcode vraagt dan de positie op) */
        void stukBegint(long startedAt);
        /** Een stuk is af: afmaken en doorgeven (niet op de opnamethread) */
        void stuk(AacBestand bestand, Knipper.Stuk stuk, long schermUitMs);
        void spreekt(boolean ja);
        void gepauzeerd(String waarom);
        void hervat(long gepauzeerdMs);
        /** Vanzelf gestopt: `max` (hard maximum) of `mic` (microfoon weg) */
        void gestopt(String reden);
        void log(String type, JSObject data);
    }

    private final Context context;
    private final File map;
    private final Knipper.Opties opties;
    private final long maxMs;
    private final Uitvoer uit;
    private final BooleanSupplier schermUit;
    private final Handler hoofd;

    private AudioRecord record;
    private Thread thread;
    private volatile boolean stoppen = false;
    /** Android zegt dat wij stilte krijgen (AudioRecordingCallback) */
    private volatile boolean stilGezet = false;
    private AudioManager.AudioRecordingCallback callback;
    long begonAt;

    TrektelOpname(
        Context context,
        File map,
        Knipper.Opties opties,
        long maxMs,
        BooleanSupplier schermUit,
        Handler hoofd,
        Uitvoer uit
    ) {
        this.context = context;
        this.map = map;
        this.opties = opties;
        this.maxMs = maxMs;
        this.schermUit = schermUit;
        this.hoofd = hoofd;
        this.uit = uit;
    }

    /** Microfoon aan; gooit als dat niet lukt. */
    @SuppressLint("MissingPermission") // De service controleert RECORD_AUDIO vóór het starten
    void start() throws IOException {
        int minBuffer = AudioRecord.getMinBufferSize(
            AacBestand.RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        );
        record = new AudioRecord(
            MediaRecorder.AudioSource.MIC,
            AacBestand.RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
            // Ruim (2 s): het afmaken van een stuk mag het lezen niet ophouden
            Math.max(minBuffer * 4, AacBestand.RATE * 2 * 2)
        );
        if (record.getState() != AudioRecord.STATE_INITIALIZED) {
            release();
            throw new IOException("AudioRecord niet klaar");
        }
        try {
            record.startRecording();
        } catch (RuntimeException e) {
            release();
            throw new IOException(e);
        }
        if (record.getRecordingState() != AudioRecord.RECORDSTATE_RECORDING) {
            release();
            throw new IOException("microfoon ging niet aan (bezet?)");
        }
        luisterNaarAndereApps();
        begonAt = System.currentTimeMillis();
        thread = new Thread(this::lees, "Trektelling");
        thread.start();
    }

    /** Stoppen; het laatste stuk gaat nog door. Wacht tot de opnamethread klaar is. */
    void stop() {
        stoppen = true;
        try {
            if (thread != null && thread != Thread.currentThread()) thread.join(3_000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private void lees() {
        int frameBytes = (int) (AacBestand.RATE * 2 * FRAME_MS / 1000);
        byte[] frame = new byte[frameBytes];
        Knipper knipper = new Knipper(opties);
        AacBestand stuk = null;
        long schermUitMs = 0;
        long nullenMs = 0;
        boolean gepauzeerd = false;
        long gepauzeerdSinds = 0;
        boolean spreekt = false;
        String reden = null;

        try {
            while (!stoppen) {
                if (System.currentTimeMillis() - begonAt >= maxMs) {
                    reden = "max";
                    break;
                }
                int gelezen = leesVol(frame);
                if (gelezen < 0) {
                    JSObject data = new JSObject();
                    data.put("code", gelezen);
                    uit.log("trektel_leesfout", data);
                    reden = "mic";
                    break;
                }
                if (gelezen == 0) continue;

                // Een andere app (of een gesprek) heeft de microfoon?
                nullenMs = Knipper.alleenNullen(frame, gelezen) ? nullenMs + FRAME_MS : 0;
                boolean stil = stilGezet || nullenMs >= NULLEN_MS;
                if (stil && !gepauzeerd) {
                    gepauzeerd = true;
                    gepauzeerdSinds = System.currentTimeMillis();
                    geefAf(stuk, knipper, schermUitMs);
                    stuk = null;
                    if (spreekt) uit.spreekt(spreekt = false);
                    uit.gepauzeerd(stilGezet ? "android" : "nullen");
                }
                if (gepauzeerd) {
                    if (stil) continue;
                    gepauzeerd = false;
                    uit.hervat(System.currentTimeMillis() - gepauzeerdSinds);
                }

                if (stuk == null) {
                    stuk = nieuwStuk();
                    schermUitMs = 0;
                }
                stuk.schrijf(frame, gelezen);
                if (schermUit.getAsBoolean()) schermUitMs += FRAME_MS;
                Knipper.Stuk klaar = knipper.meet(Knipper.niveauDb(frame, gelezen), FRAME_MS);
                if (knipper.spreekt() != spreekt) uit.spreekt(spreekt = knipper.spreekt());
                if (klaar != null) {
                    // Eerst het nieuwe bestand klaarzetten, dan het oude afgeven:
                    // het volgende blokje samples gaat al naar het nieuwe
                    AacBestand vorig = stuk;
                    stuk = nieuwStuk();
                    uit.stuk(vorig, klaar, schermUitMs);
                    schermUitMs = 0;
                }
            }
        } catch (IOException | RuntimeException e) {
            Log.w(TAG, "trektelling mislukt", e);
            JSObject data = new JSObject();
            data.put("fout", e.getClass().getSimpleName() + ": " + e.getMessage());
            uit.log("trektel_fout", data);
            reden = "mic";
        } finally {
            geefAf(stuk, knipper, schermUitMs);
            if (spreekt) uit.spreekt(false);
            release();
        }
        // Op Stop gedrukt: de service weet het al
        if (reden != null && !stoppen) uit.gestopt(reden);
    }

    /** Het lopende stuk afgeven; een stuk zonder samples (net begonnen) gaat weg. */
    private void geefAf(AacBestand stuk, Knipper knipper, long schermUitMs) {
        if (stuk == null) return;
        if (stuk.durationMs() == 0) {
            stuk.weg();
            return;
        }
        uit.stuk(stuk, knipper.klaar(), schermUitMs);
    }

    private AacBestand nieuwStuk() throws IOException {
        long at = System.currentTimeMillis();
        AacBestand bestand = new AacBestand(new File(map, "trektel-" + at + ".tmp"), at);
        uit.stukBegint(at);
        return bestand;
    }

    /** Leest één blokje van 100 ms (of minder als de microfoon ophoudt). */
    private int leesVol(byte[] frame) {
        int offset = 0;
        while (offset < frame.length && !stoppen) {
            int read = record.read(frame, offset, frame.length - offset);
            if (read < 0) return offset > 0 ? offset : read;
            if (read == 0) break;
            offset += read;
        }
        return offset;
    }

    /**
     * Android meldt elke verandering in wie er opneemt. Wij krijgen alleen
     * onze eigen opnames te zien (en die van andere apps naamloos); voor ons
     * telt `isClientSilenced`: dan heeft een andere app de microfoon.
     */
    private void luisterNaarAndereApps() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return;
        AudioManager audio = context.getSystemService(AudioManager.class);
        if (audio == null) return;
        int sessie = record.getAudioSessionId();
        callback = new AudioManager.AudioRecordingCallback() {
            @Override
            public void onRecordingConfigChanged(List<AudioRecordingConfiguration> configs) {
                boolean stil = false;
                boolean gevonden = false;
                for (AudioRecordingConfiguration config : configs) {
                    if (config.getClientAudioSessionId() == sessie) {
                        gevonden = true;
                        stil = config.isClientSilenced();
                    }
                }
                if (gevonden && stil != stilGezet) {
                    stilGezet = stil;
                    JSObject data = new JSObject();
                    data.put("stil", stil);
                    data.put("opnames", configs.size());
                    uit.log("trektel_microfoon", data);
                }
            }
        };
        audio.registerAudioRecordingCallback(callback, hoofd);
    }

    private void release() {
        if (callback != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            AudioManager audio = context.getSystemService(AudioManager.class);
            if (audio != null) audio.unregisterAudioRecordingCallback(callback);
            callback = null;
        }
        if (record != null) {
            try {
                record.stop();
            } catch (RuntimeException ignored) {}
            record.release();
            record = null;
        }
    }
}
