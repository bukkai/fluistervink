package nl.hegmus.fluistervink;

import android.annotation.SuppressLint;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import android.service.quicksettings.Tile;
import android.service.quicksettings.TileService;

/**
 * Tegel "Begin met vogelen" in de snelle instellingen (van boven naar beneden
 * vegen; docs/roadmap-android.md, stap 1). Tikken opent de app met dezelfde
 * intent als de snelkoppeling op het pictogram (SnelkoppelingPlugin), dus de
 * webcode start een sessie. Op het vergrendelscherm vraagt Android eerst om te
 * ontgrendelen. Toevoegen doet de gebruiker zelf (potloodje), of vanaf
 * Android 13 met één tik via Instellingen in de app.
 */
public class BeginTegel extends TileService {

    @Override
    public void onStartListening() {
        Tile tile = getQsTile();
        if (tile == null) return;
        tile.setState(Tile.STATE_INACTIVE);
        tile.updateTile();
    }

    @Override
    public void onClick() {
        if (isLocked()) unlockAndRun(this::open);
        else open();
    }

    @SuppressLint("StartActivityAndCollapseDeprecated")
    private void open() {
        Intent intent = SnelkoppelingPlugin.beginIntent(this).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        if (Build.VERSION.SDK_INT >= 34) {
            PendingIntent pending = PendingIntent.getActivity(
                this,
                0,
                intent,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
            );
            startActivityAndCollapse(pending);
        } else {
            startActivityAndCollapse(intent);
        }
    }
}
