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
import android.media.VolumeProvider;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
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
 * gaat als bestand naar de webcode, die hem bewaart en verwerkt.
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
    }

    /** Waar opnames en meldingen heen gaan: SchermUitPlugin */
    interface Listener {
        void gestart(long startedAt, String via);
        void opname(File file, JSObject info);
        void log(String type, JSObject data);
    }

    /** Gezet zolang de webcode het wil (ontwikkeloptie, sessie loopt, geen trektelling) */
    static Config config;
    static Listener listener;
    static WandelingService instance;
    /** Waarom het type microfoon de laatste keer niet lukte */
    static String microphoneError;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable stopAfterMax = this::stopSelf;
    private final Runnable recordingTooLong = () -> finish("max");
    private final ExecutorService worker = Executors.newSingleThreadExecutor();

    private int currentType = -1;
    private MediaSession mediaSession;
    private boolean screenOff = false;
    private boolean receiverRegistered = false;
    private long lastKeyAt = 0;
    private Opname opname;
    private String opnameVia;

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
        // Sluit Android de app toch, dan niet vanzelf herstarten: de webcode
        // start de service weer bij het openen als de sessie nog loopt
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(stopAfterMax);
        finish("service_gestopt");
        releaseScreenOff();
        worker.shutdown(); // maakt een opname die net stopte nog af
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
        }
    }

    /**
     * De mediasessie vangt de volumeknop alleen zolang hij actief is: met het
     * scherm uit, of tijdens een opname (ook op het vergrendelscherm). Met de
     * app op het scherm vangt MainActivity hem eerst (KnopPlugin), en in een
     * andere app doet de volumeknop gewoon het volume.
     */
    private void updateMediaSession() {
        boolean wanted = config != null && (screenOff || opname != null);
        if (!wanted) {
            if (mediaSession != null && mediaSession.isActive()) {
                mediaSession.setActive(false);
                log("knop_uit", null);
            }
            return;
        }
        if (mediaSession == null) mediaSession = createMediaSession();
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
        session.setPlaybackState(new PlaybackState.Builder().setState(PlaybackState.STATE_PLAYING, 0, 1f).build());
        // Alleen om te leren of de knop op de oortjes ons bereikt (latere PR):
        // loggen, verder niets
        session.setCallback(
            new MediaSession.Callback() {
                @Override
                public boolean onMediaButtonEvent(@NonNull Intent intent) {
                    KeyEvent event = intent.getParcelableExtra(Intent.EXTRA_KEY_EVENT);
                    if (event != null && event.getAction() == KeyEvent.ACTION_DOWN) {
                        JSObject data = new JSObject();
                        data.put("toets", KeyEvent.keyCodeToString(event.getKeyCode()));
                        log("mediaknop", data);
                    }
                    return super.onMediaButtonEvent(intent);
                }
            },
            handler
        );
        return session;
    }

    /** Een druk op de volumeknop (mediasessie of MainActivity): starten of stoppen */
    void press(String via) {
        long now = System.currentTimeMillis();
        boolean bounce = now - lastKeyAt < KEY_DEBOUNCE_MS;
        lastKeyAt = now;
        if (bounce || config == null) return;
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
        if (settings == null) return;
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
        updateNotification("Opname loopt · volumeknop stopt");
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
        worker.execute(() -> {
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
            text = config != null ? "Volumeknop: inspreken met het scherm uit" : "Tik om Fluistervink te openen";
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
