package nl.hegmus.fluistervink;

import android.annotation.SuppressLint;
import android.media.AudioFormat;
import android.media.AudioRecord;
import android.media.MediaCodec;
import android.media.MediaCodecInfo;
import android.media.MediaFormat;
import android.media.MediaMuxer;
import android.media.MediaRecorder;
import android.util.Log;
import java.io.File;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;

/**
 * Eén opname met de microfoon van de telefoon, in de service (opnemen met het
 * scherm uit, docs/roadmap-android.md stap 3). AudioRecord geeft de ruwe
 * samples (later ook nodig voor het wake word en het delen van de microfoon);
 * MediaCodec maakt er AAC van, MediaMuxer een .m4a ("audio/mp4", zoals de
 * webknop in Safari). Opus kan Android pas vanaf versie 10 maken, en de app
 * moet vanaf 8 werken.
 *
 * Instellingen zoals de webknop (recorder.svelte.ts): mono, 32 kbit/s, zonder
 * echo-onderdrukking (bron MIC, niet VOICE_COMMUNICATION, zodat Bluetooth niet
 * naar belmodus gaat). 16 kHz is genoeg voor spraak.
 */
final class Opname {

    private static final String TAG = "Opname";
    static final String MIME = "audio/mp4";
    private static final int RATE = 16_000;
    private static final int BIT_RATE = 32_000;
    private static final long TIMEOUT_US = 10_000;

    final File file;
    /** Moment waarop de microfoon echt aan ging (ms sinds 1970) */
    long startedAt;

    private AudioRecord record;
    private MediaCodec codec;
    private MediaMuxer muxer;
    private Thread thread;
    private volatile boolean stopRequested = false;
    private volatile long pcmBytes = 0;
    /** Hardste sample: 0 betekent dat Android de microfoon stil hield (achtergrond zonder toestemming) */
    private volatile int peak = 0;
    private volatile String error;

    Opname(File file) {
        this.file = file;
    }

    /** Start de microfoon; gooit als dat niet lukt (geen toestemming, microfoon bezet). */
    @SuppressLint("MissingPermission") // De service controleert RECORD_AUDIO vóór het starten
    void start() throws IOException {
        int minBuffer = AudioRecord.getMinBufferSize(
            RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        );
        record = new AudioRecord(
            MediaRecorder.AudioSource.MIC,
            RATE,
            AudioFormat.CHANNEL_IN_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
            Math.max(minBuffer * 2, RATE) // ±0,5 s
        );
        if (record.getState() != AudioRecord.STATE_INITIALIZED) {
            release();
            throw new IOException("AudioRecord niet klaar");
        }

        MediaFormat format = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, RATE, 1);
        format.setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC);
        format.setInteger(MediaFormat.KEY_BIT_RATE, BIT_RATE);
        format.setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 16_384);
        try {
            codec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC);
            codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE);
            codec.start();
            muxer = new MediaMuxer(file.getAbsolutePath(), MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);
            record.startRecording();
        } catch (IOException | RuntimeException e) {
            release();
            throw e instanceof IOException ? (IOException) e : new IOException(e);
        }
        if (record.getRecordingState() != AudioRecord.RECORDSTATE_RECORDING) {
            release();
            throw new IOException("microfoon ging niet aan (bezet?)");
        }
        startedAt = System.currentTimeMillis();
        thread = new Thread(this::loop, "Opname");
        thread.start();
    }

    /** Stopt en wacht tot het bestand af is. Geeft de duur in ms (van de audio zelf). */
    long stop() {
        stopRequested = true;
        try {
            if (thread != null) thread.join(5_000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        release();
        return durationMs();
    }

    long durationMs() {
        return (pcmBytes * 1000) / (RATE * 2);
    }

    int peak() {
        return peak;
    }

    String error() {
        return error;
    }

    private void loop() {
        MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();
        int track = -1;
        boolean inputDone = false;
        try {
            while (true) {
                if (!inputDone) {
                    int in = codec.dequeueInputBuffer(TIMEOUT_US);
                    if (in >= 0) {
                        ByteBuffer buffer = codec.getInputBuffer(in);
                        buffer.clear();
                        int read = record.read(buffer, buffer.remaining());
                        int size = Math.max(read, 0);
                        measurePeak(buffer, size);
                        long pts = (pcmBytes * 1_000_000L) / (RATE * 2);
                        pcmBytes += size;
                        boolean last = stopRequested || read < 0;
                        codec.queueInputBuffer(in, 0, size, pts, last ? MediaCodec.BUFFER_FLAG_END_OF_STREAM : 0);
                        if (last) inputDone = true;
                    }
                }
                // Alles wat de encoder klaar heeft naar het bestand
                while (true) {
                    int out = codec.dequeueOutputBuffer(info, inputDone ? TIMEOUT_US : 0);
                    if (out == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                        track = muxer.addTrack(codec.getOutputFormat());
                        muxer.start();
                    } else if (out >= 0) {
                        ByteBuffer data = codec.getOutputBuffer(out);
                        boolean config = (info.flags & MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0;
                        if (!config && info.size > 0 && track >= 0) {
                            data.position(info.offset);
                            data.limit(info.offset + info.size);
                            muxer.writeSampleData(track, data, info);
                        }
                        codec.releaseOutputBuffer(out, false);
                        if ((info.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) return;
                    } else if (out == MediaCodec.INFO_TRY_AGAIN_LATER) {
                        break;
                    }
                }
            }
        } catch (RuntimeException e) {
            Log.w(TAG, "opname mislukt", e);
            error = e.getClass().getSimpleName() + ": " + e.getMessage();
        }
    }

    private void measurePeak(ByteBuffer buffer, int size) {
        ByteBuffer samples = buffer.duplicate().order(ByteOrder.LITTLE_ENDIAN);
        samples.position(0);
        int max = peak;
        for (int i = 0; i + 1 < size; i += 2) {
            int value = Math.abs((int) samples.getShort(i));
            if (value > max) max = value;
        }
        peak = max;
    }

    private void release() {
        if (record != null) {
            try {
                record.stop();
            } catch (RuntimeException ignored) {}
            record.release();
            record = null;
        }
        if (codec != null) {
            try {
                codec.stop();
            } catch (RuntimeException ignored) {}
            codec.release();
            codec = null;
        }
        if (muxer != null) {
            try {
                muxer.stop();
            } catch (RuntimeException ignored) {
                // Niets geschreven (heel korte opname): geen geldig bestand
            }
            muxer.release();
            muxer = null;
        }
    }
}
