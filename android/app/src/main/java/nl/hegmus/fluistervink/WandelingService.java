package nl.hegmus.fluistervink;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

/**
 * Foreground service tijdens een wandeling (fase 2, docs/plan-capacitor.md),
 * met een vaste melding "Wandeling loopt". Doet zelf niets: hij houdt Android
 * ervan af de app te bevriezen of te sluiten met het scherm uit, zodat de
 * wachtrij in de webcode doorloopt, de GPS warm blijft en de tril na het
 * verwerken toch komt. Gestart en gestopt door WandelingPlugin.
 */
public class WandelingService extends Service {

    private static final String TAG = "WandelingService";
    private static final String CHANNEL_ID = "wandeling";
    private static final int NOTIFICATION_ID = 1;

    /**
     * Vangnet als de webcode het stoppen mist: net als een vergeten wandeling
     * (checkStaleSession in src/lib/sessions.ts) 8 uur na de laatste opname.
     * Elke opname start de service opnieuw, en zet deze klok terug.
     */
    private static final long MAX_DURATION_MS = 8 * 60 * 60_000L;

    /** Of de service draait, en waarom hij als laatste niet kon starten. */
    static volatile boolean running = false;
    static volatile String lastError = null;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable stopAfterMax = this::stopSelf;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                ? ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
                : 0;
            ServiceCompat.startForeground(this, NOTIFICATION_ID, notification(), type);
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
        // Sluit Android de app toch, dan niet vanzelf herstarten: de webcode
        // start de service weer bij het openen als de wandeling nog loopt
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(stopAfterMax);
        running = false;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private Notification notification() {
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && manager != null) {
            // Laag belang: geen geluid en geen tril bij het verschijnen
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                "Wandeling",
                NotificationManager.IMPORTANCE_LOW
            );
            channel.setDescription("Zichtbaar zolang een wandeling loopt");
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

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_vink)
            .setContentTitle("Wandeling loopt")
            .setContentText("Tik om Fluistervink te openen")
            .setContentIntent(contentIntent)
            .setOngoing(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            // Android 12+ toont de melding anders pas na tien seconden
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build();
    }
}
