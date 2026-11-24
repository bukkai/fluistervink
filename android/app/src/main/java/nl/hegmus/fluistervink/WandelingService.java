package nl.hegmus.fluistervink;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioPlaybackConfiguration;
import android.media.AudioTrack;
import android.media.VolumeProvider;
import android.os.BatteryManager;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import android.util.Log;
import android.view.KeyEvent;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import java.io.File;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.TimeUnit;

/**
 * Foreground service tijdens een sessie (fase 2, docs/plan-capacitor.md),
 * met een vaste melding "Aan het vogelen". Houdt Android ervan af de app te
 * bevriezen of te sluiten met het scherm uit, zodat de wachtrij in de
 * webcode doorloopt, de GPS warm blijft en de tril na het verwerken toch
 * komt. Gestart en gestopt door WandelingPlugin.
 *
 * Proef "opnemen met het scherm uit" (docs/roadmap-android.md stap 3,
 * ontwikkeloptie, SchermUitPlugin): dan krijgt de service ook het type
 * microfoon, vangt hij met het scherm uit de volumeknop op (een mediasessie
 * met een eigen volumeregeling), en neemt hij zelf op (Opname). Elke opname
 * gaat als bestand naar de webcode, die hem bewaart en verwerkt. De knop op
 * de oortjes (of een Bluetooth-afstandsbediening die mediatoetsen stuurt)
 * doet hetzelfde als de volumeknop, via dezelfde mediasessie.
 *
 * Trektelling met het scherm uit (zelfde proef, docs/plan-trektelmodus.md):
 * dan neemt de service de hele trektelling op en knipt hij zelf in stukken
 * (TrektelOpname). Elk stuk gaat als opname naar de webcode, net als een
 * opname met de volumeknop.
 */
public class WandelingService extends Service {

    private static final String TAG = "WandelingService";
    private static final String CHANNEL_ID = "wandeling"; // vast: een nieuw id maakt een tweede kanaal bij wie de app al heeft
    private static final int NOTIFICATION_ID = 1;

    /**
     * Vangnet als de webcode het stoppen mist: net als een vergeten sessie
     * (checkStaleSession in src/lib/sessions.ts) 8 uur na de laatste opname.
     * Elke opname start de service opnieuw, en zet deze klok terug.
     */
    private static final long MAX_DURATION_MS = 8 * 60 * 60_000L;

    /** Drukken binnen deze tijd na de vorige tellen niet: vasthouden, of een knopje dat herhaalt */
    private static final long KEY_DEBOUNCE_MS = 400;

    /**
     * Mediaknop (oortjes) binnen deze tijd na de vorige: een dubbele druk.
     * Doet niets, alleen loggen (anders start en stopt hij meteen weer).
     */
    private static final long MEDIA_DOUBLE_MS = 500;

    /** Langer ingedrukt dan dit: lang indrukken (alleen loggen) */
    private static final long MEDIA_LONG_MS = 800;

    /** Stil geluid om de mediaknop te krijgen (claimMediaButton) */
    private static final int SILENCE_MS = 300;

    /** Niet opnieuw claimen als het scherm binnen deze tijd weer uitgaat (even kijken) */
    private static final long CLAIM_AGAIN_MS = 15_000;

    /** Zoals "failed" in src/lib/feedback.ts: drie korte */
    private static final long[] TRIL_MISLUKT = { 0, 120, 150, 120, 150, 120 };

    /** Of de service draait, en waarom hij als laatste niet kon starten. */
    static volatile boolean running = false;
    static volatile String lastError = null;

    // --- Opnemen met het scherm uit (alles op de hoofdthread) ---

    /** Instellingen van de webcode (SchermUitPlugin.aan) */
    static final class Config {
        String sessionId;
        long maxMs;
        long minMs;
        long[] trilStart;
        long[] trilStop;
        /**
         * De knop op de oortjes start en stopt ook een opname (ontwikkeloptie
         * `oortjesKnop`). Uit: geen stil geluid om de knop te krijgen
         * (claimMediaButton), en een mediatoets doet niets, alleen loggen.
         * Standaard aan, zodat een oudere webcode zonder de optie hetzelfde doet
         * als vóór de splitsing (24 nov).
         */
        boolean oortjesKnop = true;
    }

    /** Waar opnames en meldingen heen gaan: SchermUitPlugin */
    interface Listener {
        void gestart(long startedAt, String via);
        void opname(File file, JSObject info);
        void log(String type, JSObject data);
        /** Volumeknop met het scherm uit terwijl de webcode zelf opneemt: die stopt hem */
        void druk(String via);
        /** Nieuws over de trektelling: stuk_begint, spreekt, gepauzeerd, hervat, gestopt */
        void trektel(String soort, JSObject data);
    }

    /** Instellingen van een trektelling (SchermUitPlugin.trektelStart) */
    static final class TrektelConfig {
        Knipper.Opties opties = new Knipper.Opties();
        long maxMs;
    }

    /** Gezet zolang de webcode het wil (ontwikkeloptie, sessie loopt, geen trektelling) */
    static Config config;
    static Listener listener;
    static WandelingService instance;
    /** Waarom het type microfoon de laatste keer niet lukte */
    static String microphoneError;
    /**
     * De webcode neemt zelf op (de knop in de app, scherm daarna op slot):
     * dan geeft de volumeknop met het scherm uit de druk aan de webcode, in
     * plaats van een tweede opname te starten
     */
    static volatile boolean webRecording = false;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable stopAfterMax = this::stopSelf;
    private final Runnable recordingTooLong = () -> finish("max");
    private final ExecutorService worker = Executors.newSingleThreadExecutor();

    private int currentType = -1;
    private MediaSession mediaSession;
    private boolean screenOff = false;
    private boolean receiverRegistered = false;
    private long lastKeyAt = 0;
    private long lastMediaKeyAt = 0;
    /** Wanneer we de mediaknop het laatst probeerden te krijgen (uptime), 0 = nooit */
    private long claimedAt = 0;
    private Opname opname;
    private String opnameVia;
    /** Loopt er een trektelling in de service (alleen met `config`) */
    private volatile TrektelOpname trektel;
    // Opgehoogd op de worker, gelezen op de hoofdthread
    private volatile int trektelStukken = 0;
    private volatile int trektelStil = 0;
    private Integer accuBegin;

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            applyType();
        } catch (RuntimeException e) {
            // Bv. geen locatietoestemming, of gestart vanaf de achtergrond
            Log.w(TAG, "startForeground mislukt", e);
            lastError = e.getClass().getSimpleName() + ": " + e.getMessage();
            running = false;
            stopSelf();
            return START_NOT_STICKY;
        }
        running = true;
        lastError = null;
        handler.removeCallbacks(stopAfterMax);
        handler.postDelayed(stopAfterMax, MAX_DURATION_MS);
        updateScreenOff();
        if (config != null) {
            // De webcode zette de proef misschien aan vóór de service draaide
            // (`aan` gaf dan "service draait niet"): zeggen dat het nu kan
            JSObject data = new JSObject();
            data.put("microfoon", microphoneReady());
            if (microphoneError != null) data.put("fout", microphoneError);
            log("service_klaar", data);
        }
        // Sluit Android de app toch, dan niet vanzelf herstarten: de webcode
        // start de service weer bij het openen als de sessie nog loopt
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(stopAfterMax);
        stopTrektel("service_gestopt");
        finish("service_gestopt");
        releaseScreenOff();
        worker.shutdown(); // maakt een opname die net stopte nog af
        // De instellingen horen bij deze sessie. Zonder dit nam de service van
        // een volgende sessie op met het oude sessie-id als de webcode `uit`
        // niet meer zei (app weggeveegd, ontwikkeloptie intussen uit).
        config = null;
        webRecording = false;
        running = false;
        if (instance == this) instance = null;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    /**
     * Zet het type van de service: locatie, en microfoon als de webcode
     * opnemen met het scherm uit aan heeft. Android 14+ staat microfoon
     * alleen toe als de app op het scherm staat en de toestemming er is; lukt
     * het niet, dan alleen locatie (de service moet blijven draaien).
     * Gooit als zelfs dat niet lukt.
     */
    private void applyType() {
        boolean microphone = config != null && hasMicrophone(this);
        int type = type(microphone);
        // Al zo: niet opnieuw (vanaf de achtergrond zou microfoon geweigerd worden)
        if (running && type == currentType) return;
        try {
            ServiceCompat.startForeground(this, NOTIFICATION_ID, notification(), type);
            currentType = type;
            microphoneError = config != null && !microphone ? "geen microfoontoestemming" : null;
        } catch (RuntimeException e) {
            if (!microphone) throw e;
            Log.w(TAG, "type microfoon geweigerd", e);
            microphoneError = e.getClass().getSimpleName() + ": " + e.getMessage();
            int fallback = type(false);
            ServiceCompat.startForeground(this, NOTIFICATION_ID, notification(), fallback);
            currentType = fallback;
        }
    }

    private static int type(boolean microphone) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return 0;
        int type = ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION;
        if (microphone && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            type |= ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE;
        }
        return type;
    }

    /** Heeft de service nu het type microfoon (vóór Android 11 is dat niet nodig)? */
    boolean microphoneReady() {
        if (!hasMicrophone(this)) return false;
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return true;
        return currentType >= 0 && (currentType & ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE) != 0;
    }

    static boolean hasMicrophone(Context context) {
        return (
            ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED
        );
    }

    /** Na `config` zetten: type bijwerken (alleen met de app op het scherm), volumeknop aan. */
    void arm() {
        try {
            applyType();
        } catch (RuntimeException e) {
            Log.w(TAG, "type bijwerken mislukt", e);
        }
        updateScreenOff();
    }

    /** Uitzetten: een lopende opname afmaken en doorgeven, volumeknop terug naar Android. */
    void disarm() {
        stopTrektel("uitgezet");
        finish("uitgezet");
        config = null;
        arm();
    }

    static boolean isRecording() {
        return instance != null && instance.opname != null;
    }

    // --- Volumeknop met het scherm uit ---

    private final BroadcastReceiver screenReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            screenOff = Intent.ACTION_SCREEN_OFF.equals(intent.getAction());
            updateMediaSession();
            // Scherm uit: misschien is er intussen een podcast begonnen; de
            // knop op de oortjes weer naar ons. Niet na even kijken.
            if (screenOff && SystemClock.uptimeMillis() - claimedAt > CLAIM_AGAIN_MS) {
                claimMediaButton("scherm_uit");
            }
        }
    };

    private void updateScreenOff() {
        if (config == null) {
            releaseScreenOff();
            return;
        }
        if (!receiverRegistered) {
            IntentFilter filter = new IntentFilter();
            filter.addAction(Intent.ACTION_SCREEN_OFF);
            filter.addAction(Intent.ACTION_SCREEN_ON);
            // Uitzendingen van Android zelf komen ook zo binnen
            ContextCompat.registerReceiver(this, screenReceiver, filter, ContextCompat.RECEIVER_NOT_EXPORTED);
            receiverRegistered = true;
            PowerManager power = getSystemService(PowerManager.class);
            screenOff = power != null && !power.isInteractive();
        }
        updateMediaSession();
        // Begin van de sessie (of de optie net aangezet): de knop op de
        // oortjes naar ons, ook als er net een podcast speelde
        if (claimedAt == 0) claimMediaButton("sessie");
    }

    private void releaseScreenOff() {
        if (receiverRegistered) {
            unregisterReceiver(screenReceiver);
            receiverRegistered = false;
        }
        if (mediaSession != null) {
            mediaSession.setActive(false);
            mediaSession.release();
            mediaSession = null;
            claimedAt = 0;
        }
    }

    /**
     * De mediasessie vangt de volumeknop alleen zolang hij actief is: met het
     * scherm uit, of tijdens een opname (ook op het vergrendelscherm). Met de
     * app op het scherm vangt MainActivity hem eerst (KnopPlugin), en in een
     * andere app doet de volumeknop gewoon het volume. De knop op de oortjes
     * hangt daar niet van af, alleen van wie het laatst geluid afspeelde.
     */
    private void updateMediaSession() {
        if (config == null) return;
        // De sessie bestaat de hele sessie lang, ook met het scherm aan: dan
        // kan Android hem de knop op de oortjes geven (claimMediaButton)
        if (mediaSession == null) mediaSession = createMediaSession();
        boolean wanted = screenOff || opname != null;
        if (!wanted) {
            if (mediaSession != null && mediaSession.isActive()) {
                mediaSession.setActive(false);
                log("knop_uit", null);
            }
            return;
        }
        if (!mediaSession.isActive()) {
            mediaSession.setActive(true);
            JSObject data = new JSObject();
            data.put("schermUit", screenOff);
            data.put("microfoon", microphoneReady());
            if (microphoneError != null) data.put("fout", microphoneError);
            log("knop_aan", data);
        }
    }

    private MediaSession createMediaSession() {
        MediaSession session = new MediaSession(this, "Fluistervink");
        // Een "afspelende" sessie met een eigen volumeregeling: Android geeft
        // de volumeknop dan aan ons (onAdjustVolume) in plaats van het volume
        // te veranderen, ook met het scherm uit
        session.setPlaybackToRemote(
            new VolumeProvider(VolumeProvider.VOLUME_CONTROL_RELATIVE, 100, 50) {
                @Override
                public void onAdjustVolume(int direction) {
                    // 0 = loslaten
                    if (direction != 0) handler.post(() -> press(direction > 0 ? "volume_up" : "volume_down"));
                }
            }
        );
        session.setPlaybackState(
            new PlaybackState.Builder()
                .setState(PlaybackState.STATE_PLAYING, 0, 1f)
                .setActions(PlaybackState.ACTION_PLAY | PlaybackState.ACTION_PAUSE | PlaybackState.ACTION_PLAY_PAUSE)
                .build()
        );
        // De knop op de oortjes of een afstandsbediening: een mediatoets.
        // Komt ook binnen als de sessie niet actief is (scherm aan), zolang
        // Android ons de mediaknop geeft (claimMediaButton). Niet doorgeven
        // aan Android (super): dat zou bij een dubbele druk "volgende" doen.
        session.setCallback(
            new MediaSession.Callback() {
                @Override
                public boolean onMediaButtonEvent(@NonNull Intent intent) {
                    KeyEvent event = intent.getParcelableExtra(Intent.EXTRA_KEY_EVENT);
                    if (event == null) return false;
                    mediaKey(event);
                    return true;
                }

                // Sommige Bluetooth-apparaten (AVRCP) of horloges sturen geen
                // toets maar meteen afspelen of pauzeren
                @Override
                public void onPlay() {
                    mediaPress("transport_play", SystemClock.uptimeMillis());
                }

                @Override
                public void onPause() {
                    mediaPress("transport_pause", SystemClock.uptimeMillis());
                }
            },
            handler
        );
        return session;
    }

    // --- De knop op de oortjes (mediaknop) ---

    private static boolean isTalkKey(int code) {
        return (
            code == KeyEvent.KEYCODE_HEADSETHOOK ||
            code == KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE ||
            code == KeyEvent.KEYCODE_MEDIA_PLAY ||
            code == KeyEvent.KEYCODE_MEDIA_PAUSE
        );
    }

    /**
     * Een mediatoets: indrukken start of stopt een opname, net als de
     * volumeknop. Andere toetsen (volgende, vorige), vasthouden, lang
     * indrukken en een dubbele druk doen niets; alles komt wel in het log.
     */
    private void mediaKey(KeyEvent event) {
        int code = event.getKeyCode();
        String key = KeyEvent.keyCodeToString(code);
        if (event.getAction() == KeyEvent.ACTION_UP) {
            long heldMs = event.getEventTime() - event.getDownTime();
            if (isTalkKey(code) && heldMs >= MEDIA_LONG_MS) {
                JSObject data = mediaLog(key);
                data.put("actie", "lang");
                data.put("ingedruktMs", heldMs);
                log("mediaknop", data);
            }
            return;
        }
        if (event.getAction() != KeyEvent.ACTION_DOWN) return;
        if (!isTalkKey(code)) {
            JSObject data = mediaLog(key);
            data.put("actie", "genegeerd");
            log("mediaknop", data);
            return;
        }
        // Vasthouden: Android herhaalt de toets
        if (event.getRepeatCount() > 0) {
            if (event.getRepeatCount() == 1) {
                JSObject data = mediaLog(key);
                data.put("actie", "vasthouden");
                log("mediaknop", data);
            }
            return;
        }
        mediaPress(key, event.getDownTime());
    }

    private void mediaPress(String key, long at) {
        boolean twice = lastMediaKeyAt > 0 && at - lastMediaKeyAt < MEDIA_DOUBLE_MS;
        lastMediaKeyAt = at;
        boolean knop = config != null && config.oortjesKnop;
        JSObject data = mediaLog(key);
        // Knop uit: de koptelefoon stuurt soms zelf pauze als de bron wisselt
        // (Sony XM5, 24 nov); dat mag geen opname starten
        data.put("actie", !knop ? "knop_uit" : twice ? "dubbel" : "druk");
        log("mediaknop", data);
        if (knop && !twice) press("oortjes");
    }

    /** Wat we bij elke mediatoets loggen: welke, en sinds wanneer we de knop hebben */
    private JSObject mediaLog(String key) {
        JSObject data = new JSObject();
        data.put("toets", key);
        data.put("schermUit", screenOff);
        if (claimedAt > 0) data.put("sindsClaimMs", SystemClock.uptimeMillis() - claimedAt);
        return data;
    }

    /**
     * Android geeft de mediaknop (oortjes, afstandsbediening) aan de app die
     * het laatst geluid begon af te spelen en een mediasessie heeft. Onze
     * sessie speelt niets, dus na een podcast krijgt de podcast de knop.
     * Daarom spelen we kort stilte af (gebruik "media", zonder audiofocus):
     * dan zijn wij de laatste. Dat helpt alleen als er verder niets speelt;
     * speelt een podcast nog, dan zet Android die weer vooraan zodra onze
     * stilte stopt.
     *
     * Bewust niet verder (proeven 18 nov, docs/roadmap-android.md): stilte
     * blijven afspelen zolang een podcast speelt gaf ons de knop wel, maar
     * Android (Bluetooth AVRCP) gooit "afspelen" weg als er muziek speelt en
     * "pauzeren" als er niets speelt. Oortjes die die twee zelf afwisselen
     * (Sony WH-1000XM5) kwamen dus maar half door, ook als we tussendoor
     * "gepauzeerd" meldden. Voor een knop op het stuur: een sluiterknopje,
     * dat een volumetoets stuurt.
     */
    private void claimMediaButton(String why) {
        if (config == null || mediaSession == null || !config.oortjesKnop) return;
        claimedAt = SystemClock.uptimeMillis();
        JSObject data = new JSObject();
        data.put("waarom", why);
        data.put("audiofocus", false);
        AudioManager audio = getSystemService(AudioManager.class);
        if (audio != null) {
            // Wie de knop had, mag Android ons niet vertellen; wel of er iets speelt
            data.put("anderGeluid", audio.isMusicActive());
            int players = 0;
            for (AudioPlaybackConfiguration playback : audio.getActivePlaybackConfigurations()) {
                int usage = playback.getAudioAttributes().getUsage();
                if (usage == AudioAttributes.USAGE_MEDIA || usage == AudioAttributes.USAGE_UNKNOWN) players++;
            }
            data.put("mediaSpelers", players);
        }
        try {
            int rate = 16_000;
            int samples = (rate * SILENCE_MS) / 1000;
            AudioTrack track = new AudioTrack.Builder()
                .setAudioAttributes(
                    new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build()
                )
                .setAudioFormat(
                    new AudioFormat.Builder()
                        .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                        .setSampleRate(rate)
                        .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                        .build()
                )
                .setTransferMode(AudioTrack.MODE_STATIC)
                .setBufferSizeInBytes(samples * 2)
                .build();
            track.write(new short[samples], 0, samples);
            track.play();
            handler.postDelayed(
                () -> {
                    try {
                        track.stop();
                    } catch (IllegalStateException ignored) {
                        // Al gestopt
                    }
                    track.release();
                },
                SILENCE_MS + 500
            );
            data.put("ok", true);
        } catch (RuntimeException e) {
            data.put("ok", false);
            data.put("fout", e.getClass().getSimpleName() + ": " + e.getMessage());
        }
        log("knop_claim", data);
    }

    /** Een druk op de volumeknop of de oortjes (mediasessie of MainActivity): starten of stoppen */
    void press(String via) {
        long now = System.currentTimeMillis();
        boolean bounce = now - lastKeyAt < KEY_DEBOUNCE_MS;
        lastKeyAt = now;
        if (bounce || config == null) return;
        if (trektel != null) {
            // De trektelling heeft de microfoon al; de knop doet dan niets
            JSObject data = new JSObject();
            data.put("via", via);
            log("druk_trektel", data);
            return;
        }
        if (opname == null && webRecording) {
            if (listener != null) listener.druk(via);
            return;
        }
        if (opname != null) finish(via);
        else startRecording(via);
    }

    // --- Opnemen ---

    static File directory(Context context) {
        File dir = new File(context.getFilesDir(), "scherm-uit");
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();
        return dir;
    }

    private void startRecording(String via) {
        Config settings = config;
        if (settings == null || trektel != null) return;
        if (!microphoneReady()) {
            // Zonder type microfoon geeft Android met het scherm uit alleen stilte
            JSObject data = new JSObject();
            data.put("reden", microphoneError != null ? microphoneError : "geen type microfoon");
            log("niet_gestart", data);
            TrillenPlugin.tril(this, TRIL_MISLUKT);
            return;
        }
        Opname next = new Opname(new File(directory(this), "opname.tmp"));
        try {
            next.start();
        } catch (Exception e) {
            JSObject data = new JSObject();
            data.put("reden", e.getClass().getSimpleName() + ": " + e.getMessage());
            log("niet_gestart", data);
            TrillenPlugin.tril(this, TRIL_MISLUKT);
            return;
        }
        opname = next;
        opnameVia = via;
        TrillenPlugin.tril(this, settings.trilStart);
        handler.postDelayed(recordingTooLong, settings.maxMs);
        updateNotification("Opname loopt · volumeknop of oortjes stopt");
        updateMediaSession();
        if (listener != null) listener.gestart(next.startedAt, via);
    }

    /** Stopt een lopende opname en geeft hem door; niets als er geen loopt. */
    void finish(String via) {
        Opname current = opname;
        Config settings = config;
        if (current == null || settings == null) return;
        opname = null;
        handler.removeCallbacks(recordingTooLong);
        long stoppedAt = System.currentTimeMillis();
        TrillenPlugin.tril(this, settings.trilStop);
        updateNotification(null);
        updateMediaSession();
        String startVia = opnameVia;
        // Het bestand afmaken kost even: niet op de hoofdthread
        opWorker(() -> {
            long durationMs = current.stop();
            JSObject info = new JSObject();
            info.put("startedAt", current.startedAt);
            info.put("durationMs", durationMs);
            info.put("gestoptAt", stoppedAt);
            info.put("klaarAt", System.currentTimeMillis());
            info.put("piek", current.peak());
            info.put("start", startVia);
            info.put("stop", via);
            if (current.error() != null) info.put("fout", current.error());
            File file = current.file;
            // Een per ongeluk aangetikte knop, of niets opgenomen: weggooien, zoals de webknop
            if (durationMs < settings.minMs || file.length() == 0 || current.error() != null) {
                //noinspection ResultOfMethodCallIgnored
                file.delete();
                handler.post(() -> log("weggegooid", info));
                return;
            }
            // De naam zegt alles wat de webcode nodig heeft, ook na een herstart van de app
            File done = new File(
                file.getParentFile(),
                settings.sessionId + "_" + current.startedAt + "_" + durationMs + ".m4a"
            );
            File delivered = file.renameTo(done) ? done : file;
            handler.post(() -> {
                if (listener != null) listener.opname(delivered, info);
            });
        });
    }

    // --- Trektelling met het scherm uit ---

    static boolean isTrektelling() {
        return instance != null && instance.trektel != null;
    }

    /** Begint een trektelling in de service. Geeft null, of waarom het niet kan. */
    synchronized String startTrektel(TrektelConfig settings) {
        Config session = config;
        if (session == null) return "niet aangezet";
        if (trektel != null) return "loopt al";
        if (opname != null) return "opname loopt";
        if (!microphoneReady()) return microphoneError != null ? microphoneError : "geen type microfoon";
        TrektelOpname next = new TrektelOpname(
            this,
            directory(this),
            settings.opties,
            settings.maxMs,
            () -> screenOff,
            handler,
            new TrektelUitvoer(session.sessionId)
        );
        try {
            next.start();
        } catch (Exception e) {
            return e.getClass().getSimpleName() + ": " + e.getMessage();
        }
        trektel = next;
        trektelStukken = 0;
        trektelStil = 0;
        accuBegin = accu();
        handler.post(() -> {
            updateNotification("Trektelling loopt · het scherm mag uit");
            updateMediaSession();
        });
        return null;
    }

    /**
     * Stopt de trektelling; het laatste stuk gaat nog naar de webcode.
     * Geeft wat de telling deed (accu, stukken), of null als er geen liep.
     */
    synchronized JSObject stopTrektel(String reden) {
        TrektelOpname current = trektel;
        if (current == null) return null;
        trektel = null;
        current.stop();
        JSObject data = trektelStand(current, reden);
        handler.post(() -> {
            updateNotification(null);
            updateMediaSession();
        });
        return data;
    }

    private JSObject trektelStand(TrektelOpname current, String reden) {
        JSObject data = new JSObject();
        data.put("reden", reden);
        data.put("durationMs", System.currentTimeMillis() - current.begonAt);
        data.put("stukken", trektelStukken);
        data.put("stil", trektelStil);
        if (accuBegin != null) data.put("accuBegin", accuBegin);
        Integer eind = accu();
        if (eind != null) data.put("accuEind", eind);
        return data;
    }

    /**
     * Op de worker; is die al dicht (onDestroy, terwijl de opnamethread het
     * laatste stuk nog afgaf na de 3 s van `stop`), dan hier. Anders gooit
     * `execute` en crasht de app, en blijft het stuk als .tmp liggen.
     */
    private void opWorker(Runnable taak) {
        try {
            worker.execute(taak);
        } catch (RejectedExecutionException e) {
            taak.run();
        }
    }

    /** Wacht tot alle stukken en opnames af zijn (bestand staat klaar) */
    void flush() {
        try {
            worker.submit(() -> {}).get(5, TimeUnit.SECONDS);
        } catch (Exception ignored) {
            // Te laat of al gestopt: `wachtend` vindt ze later
        }
    }

    /** Accu in procenten, als Android het zegt */
    private Integer accu() {
        BatteryManager battery = getSystemService(BatteryManager.class);
        if (battery == null) return null;
        int level = battery.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
        return level > 0 && level <= 100 ? level : null;
    }

    /** Wat de opnamethread van de trektelling meldt; alles naar de hoofdthread of de worker */
    private final class TrektelUitvoer implements TrektelOpname.Uitvoer {

        private final String sessionId;

        TrektelUitvoer(String sessionId) {
            this.sessionId = sessionId;
        }

        @Override
        public void stukBegint(long startedAt) {
            JSObject data = new JSObject();
            data.put("startedAt", startedAt);
            handler.post(() -> trektelNieuws("stuk_begint", data));
        }

        @Override
        public void stuk(AacBestand bestand, Knipper.Stuk stuk, long schermUitMs) {
            long gestoptAt = System.currentTimeMillis();
            opWorker(() -> {
                JSObject info = new JSObject();
                info.put("startedAt", bestand.startedAt);
                info.put("trektel", true);
                info.put("spraakMs", stuk.spraakMs);
                info.put("piekDb", stuk.piekDb);
                info.put("achtergrondDb", stuk.achtergrondDb);
                info.put("schermUitMs", schermUitMs);
                info.put("gestoptAt", gestoptAt);
                if (!stuk.heeftSpraak) {
                    // Stilte: niet bewaren, wel loggen (zoals trektel_silence in de webcode)
                    bestand.weg();
                    info.put("durationMs", stuk.duurMs);
                    trektelStil++;
                    handler.post(() -> {
                        log("trektel_stilte", info);
                        trektelNieuws("stuk", stukTelling());
                    });
                    return;
                }
                long durationMs;
                try {
                    durationMs = bestand.klaar();
                } catch (RuntimeException e) {
                    durationMs = 0;
                    info.put("fout", e.getClass().getSimpleName() + ": " + e.getMessage());
                }
                info.put("durationMs", durationMs);
                info.put("klaarAt", System.currentTimeMillis());
                if (bestand.leeg() || durationMs == 0) {
                    //noinspection ResultOfMethodCallIgnored
                    bestand.file.delete();
                    handler.post(() -> log("trektel_weggegooid", info));
                    return;
                }
                File done = new File(
                    bestand.file.getParentFile(),
                    sessionId + "_" + bestand.startedAt + "_" + durationMs + "_trektel.m4a"
                );
                File delivered = bestand.file.renameTo(done) ? done : bestand.file;
                trektelStukken++;
                handler.post(() -> {
                    trektelNieuws("stuk", stukTelling());
                    if (listener != null) listener.opname(delivered, info);
                });
            });
        }

        @Override
        public void spreekt(boolean ja) {
            JSObject data = new JSObject();
            data.put("ja", ja);
            handler.post(() -> trektelNieuws("spreekt", data));
        }

        @Override
        public void gepauzeerd(String waarom) {
            JSObject data = new JSObject();
            data.put("waarom", waarom);
            data.put("schermUit", screenOff);
            handler.post(() -> {
                updateNotification("Trektelling gepauzeerd · een andere app heeft de microfoon");
                trektelNieuws("gepauzeerd", data);
            });
        }

        @Override
        public void hervat(long gepauzeerdMs) {
            JSObject data = new JSObject();
            data.put("pausedMs", gepauzeerdMs);
            data.put("schermUit", screenOff);
            handler.post(() -> {
                updateNotification("Trektelling loopt · het scherm mag uit");
                trektelNieuws("hervat", data);
            });
        }

        @Override
        public void gestopt(String reden) {
            // Vanzelf (maximum, microfoon weg): de webcode stopt de telling met uitleg
            handler.post(() -> {
                JSObject data = stopTrektel(reden);
                if (data != null) trektelNieuws("gestopt", data);
            });
        }

        @Override
        public void log(String type, JSObject data) {
            handler.post(() -> WandelingService.this.log(type, data));
        }
    }

    private JSObject stukTelling() {
        JSObject data = new JSObject();
        data.put("stukken", trektelStukken);
        data.put("stil", trektelStil);
        return data;
    }

    private void trektelNieuws(String soort, JSObject data) {
        if (listener != null) listener.trektel(soort, data);
    }

    private void log(String type, JSObject data) {
        if (listener != null) listener.log(type, data != null ? data : new JSObject());
    }

    // --- Melding ---

    private void updateNotification(String text) {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null && running) manager.notify(NOTIFICATION_ID, notification(text));
    }

    private Notification notification() {
        return notification(null);
    }

    private Notification notification(String text) {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && manager != null) {
            // Laag belang: geen geluid en geen tril bij het verschijnen
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Sessie",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Zichtbaar zolang een sessie loopt");
            channel.setShowBadge(false);
            manager.createNotificationChannel(channel);
        }

        // Tikken op de melding opent de app weer
        Intent open = new Intent(this, MainActivity.class)
            .setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
            this,
            0,
            open,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );

        if (text == null) {
            text = config != null ? "Volumeknop of oortjes: inspreken met het scherm uit" : "Tik om Fluistervink te openen";
        }
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_vink)
            .setContentTitle("Aan het vogelen")
            .setContentText(text)
            .setContentIntent(contentIntent)
            .setOngoing(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            // Android 12+ toont de melding anders pas na tien seconden
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build();
    }
}
