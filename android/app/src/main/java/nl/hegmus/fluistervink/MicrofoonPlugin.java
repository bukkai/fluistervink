package nl.hegmus.fluistervink;

import android.Manifest;
import android.content.Context;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * Welke microfoons er zijn (src/lib/microphone.ts). De webcode kiest zelf met
 * getUserMedia, maar de WebView toont de microfoon van Bluetooth-oortjes pas
 * als de app de toestemming "Apparaten in de buurt" (BLUETOOTH_CONNECT,
 * Android 12+) heeft. Die vraagt de app alleen bij de proef "Microfoon van de
 * oortjes" (ontwikkeloptie, feedback 17 nov: telefoon in de broekzak).
 */
@CapacitorPlugin(
    name = "Microfoon",
    permissions = { @Permission(alias = "bluetooth", strings = { Manifest.permission.BLUETOOTH_CONNECT }) }
)
public class MicrofoonPlugin extends Plugin {

    /** Zijn er oortjes of een headset met microfoon, en mag de WebView Bluetooth zien? */
    @PluginMethod
    public void status(PluginCall call) {
        call.resolve(status());
    }

    /** Vraagt "Apparaten in de buurt", als dat nog kan; geeft daarna de status. */
    @PluginMethod
    public void vraagBluetooth(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && getPermissionState("bluetooth") != PermissionState.GRANTED) {
            requestPermissionForAlias("bluetooth", call, "naBluetooth");
            return;
        }
        call.resolve(status());
    }

    @PermissionCallback
    private void naBluetooth(PluginCall call) {
        call.resolve(status());
    }

    private JSObject status() {
        JSObject result = new JSObject();
        result.put("oortjes", headsetMicrophone(getContext()));
        result.put(
            "bluetooth",
            Build.VERSION.SDK_INT < Build.VERSION_CODES.S || getPermissionState("bluetooth") == PermissionState.GRANTED
        );
        return result;
    }

    /** Een headset met microfoon: draad, USB of Bluetooth (geen gewone koptelefoon zonder microfoon). */
    static boolean headsetMicrophone(Context context) {
        AudioManager audio = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
        for (AudioDeviceInfo device : audio.getDevices(AudioManager.GET_DEVICES_INPUTS)) {
            switch (device.getType()) {
                case AudioDeviceInfo.TYPE_WIRED_HEADSET:
                case AudioDeviceInfo.TYPE_USB_HEADSET:
                case AudioDeviceInfo.TYPE_BLUETOOTH_SCO:
                case AudioDeviceInfo.TYPE_BLE_HEADSET:
                    return true;
                default:
                    break;
            }
        }
        return false;
    }
}
