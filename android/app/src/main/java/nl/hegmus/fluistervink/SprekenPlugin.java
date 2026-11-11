package nl.hegmus.fluistervink;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioDeviceInfo;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Gesproken bevestiging in de oortjes ("houtduif, zes, overvliegend";
 * docs/roadmap-android.md, stap 2). Met de tekst-naar-spraak van Android zelf:
 * geen API, geen kosten. Alleen als er oortjes of een headset aan zitten,
 * nooit via de luidspreker (besloten 11 nov). Een podcast gaat even zachter
 * (audiofocus "ducking") en daarna weer verder.
 */
@CapacitorPlugin(name = "Spreken")
public class SprekenPlugin extends Plugin {

    private TextToSpeech tts;
    /** null = nog bezig met opstarten, daarna true of false */
    private Boolean ready;
    private String problem;
    /** Wat er gezegd moet worden terwijl de spraak nog opstart */
    private final List<String> waiting = new ArrayList<>();
    private AudioFocusRequest focus;
    private int speaking = 0;

    private static final AudioAttributes ATTRIBUTES = new AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_ASSISTANCE_NAVIGATION_GUIDANCE)
        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
        .build();

    @PluginMethod
    public void zeg(PluginCall call) {
        String text = call.getString("tekst", "");
        JSObject result = new JSObject();
        if (text == null || text.isEmpty()) {
            result.put("gesproken", false);
            result.put("reden", "geen tekst");
            call.resolve(result);
            return;
        }
        if (!headphonesConnected(getContext())) {
            result.put("gesproken", false);
            result.put("reden", "geen oortjes");
            call.resolve(result);
            return;
        }
        synchronized (this) {
            if (ready == null && tts == null) start();
            if (ready == null) {
                waiting.add(text);
                result.put("gesproken", true);
                call.resolve(result);
                return;
            }
        }
        if (!ready) {
            result.put("gesproken", false);
            result.put("reden", problem);
            call.resolve(result);
            return;
        }
        speak(text);
        result.put("gesproken", true);
        call.resolve(result);
    }

    /** Zijn er oortjes of een headset (draad, USB of Bluetooth)? */
    static boolean headphonesConnected(Context context) {
        AudioManager audio = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        for (AudioDeviceInfo device : audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {
            switch (device.getType()) {
                case AudioDeviceInfo.TYPE_WIRED_HEADSET:
                case AudioDeviceInfo.TYPE_WIRED_HEADPHONES:
                case AudioDeviceInfo.TYPE_USB_HEADSET:
                case AudioDeviceInfo.TYPE_BLUETOOTH_A2DP:
                case AudioDeviceInfo.TYPE_BLUETOOTH_SCO:
                case AudioDeviceInfo.TYPE_BLE_HEADSET:
                    return true;
                default:
                    break;
            }
        }
        return false;
    }

    private void start() {
        tts = new TextToSpeech(getContext(), (status) -> {
            List<String> todo;
            synchronized (this) {
                if (status != TextToSpeech.SUCCESS) {
                    ready = false;
                    problem = "spraak start niet";
                } else {
                    int language = tts.setLanguage(new Locale("nl", "NL"));
                    if (language == TextToSpeech.LANG_MISSING_DATA || language == TextToSpeech.LANG_NOT_SUPPORTED) {
                        ready = false;
                        problem = "geen Nederlandse stem";
                    } else {
                        ready = true;
                        tts.setAudioAttributes(ATTRIBUTES);
                        tts.setOnUtteranceProgressListener(new Progress());
                    }
                }
                todo = new ArrayList<>(waiting);
                waiting.clear();
            }
            if (Boolean.TRUE.equals(ready)) for (String text : todo) speak(text);
        });
    }

    private void speak(String text) {
        synchronized (this) {
            if (speaking++ == 0) requestFocus();
        }
        Bundle params = new Bundle();
        // Achter elkaar, zodat een tweede bevestiging de eerste niet afkapt
        if (tts.speak(text, TextToSpeech.QUEUE_ADD, params, UUID.randomUUID().toString()) != TextToSpeech.SUCCESS) {
            done();
        }
    }

    private void requestFocus() {
        AudioManager audio = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        focus = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK)
            .setAudioAttributes(ATTRIBUTES)
            .build();
        audio.requestAudioFocus(focus);
    }

    private synchronized void done() {
        if (--speaking > 0 || focus == null) return;
        speaking = 0;
        AudioManager audio = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        audio.abandonAudioFocusRequest(focus);
        focus = null;
    }

    private class Progress extends UtteranceProgressListener {

        @Override
        public void onStart(String utteranceId) {}

        @Override
        public void onDone(String utteranceId) {
            done();
        }

        @Override
        public void onError(String utteranceId) {
            done();
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (tts != null) tts.shutdown();
        super.handleOnDestroy();
    }
}
