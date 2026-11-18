package nl.hegmus.fluistervink;

import android.media.MediaCodec;
import android.media.MediaCodecInfo;
import android.media.MediaFormat;
import android.media.MediaMuxer;
import java.io.File;
import java.io.IOException;
import java.nio.ByteBuffer;

/**
 * Eén .m4a-bestand (AAC, mono, 32 kbit/s, 16 kHz, zoals Opname) dat ruwe
 * samples krijgt van buiten. Voor de trektelling in de service
 * (TrektelOpname): één microfoon die blijft lopen, en per stuk een nieuw
 * bestand, zodat er tussen twee stukken niets wegvalt en niets dubbel is.
 *
 * Niet thread-safe: `schrijf` op de opnamethread, `klaar` daarna op een
 * andere thread mag, zolang er niet meer geschreven wordt.
 */
final class AacBestand {

    static final int RATE = 16_000;
    private static final int BIT_RATE = 32_000;
    private static final long TIMEOUT_US = 10_000;

    final File file;
    /** Begin van het stuk (ms sinds 1970) */
    final long startedAt;

    private MediaCodec codec;
    private MediaMuxer muxer;
    private int track = -1;
    private long pcmBytes = 0;
    private boolean geschreven = false;

    AacBestand(File file, long startedAt) throws IOException {
        this.file = file;
        this.startedAt = startedAt;
        MediaFormat format = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, RATE, 1);
        format.setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC);
        format.setInteger(MediaFormat.KEY_BIT_RATE, BIT_RATE);
        format.setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 16_384);
        try {
            codec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC);
            codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE);
            codec.start();
            muxer = new MediaMuxer(file.getAbsolutePath(), MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4);
        } catch (IOException | RuntimeException e) {
            release();
            throw e instanceof IOException ? (IOException) e : new IOException(e);
        }
    }

    /** Duur van de audio die erin zit */
    long durationMs() {
        return (pcmBytes * 1000) / (RATE * 2);
    }

    /** Ruwe samples (16 bit, mono) erbij. */
    void schrijf(byte[] pcm, int lengte) {
        int offset = 0;
        while (offset < lengte) {
            int in = codec.dequeueInputBuffer(TIMEOUT_US);
            if (in < 0) {
                drain(false);
                continue;
            }
            ByteBuffer buffer = codec.getInputBuffer(in);
            buffer.clear();
            int n = Math.min(buffer.remaining(), lengte - offset);
            buffer.put(pcm, offset, n);
            long pts = (pcmBytes * 1_000_000L) / (RATE * 2);
            pcmBytes += n;
            offset += n;
            codec.queueInputBuffer(in, 0, n, pts, 0);
            drain(false);
        }
    }

    /** Afmaken: encoder leeglopen en het bestand sluiten. Geeft de duur in ms. */
    long klaar() {
        try {
            int in;
            long tot = System.currentTimeMillis() + 2_000;
            while ((in = codec.dequeueInputBuffer(TIMEOUT_US)) < 0 && System.currentTimeMillis() < tot) drain(false);
            if (in >= 0) {
                long pts = (pcmBytes * 1_000_000L) / (RATE * 2);
                codec.queueInputBuffer(in, 0, 0, pts, MediaCodec.BUFFER_FLAG_END_OF_STREAM);
                drain(true);
            }
        } finally {
            release();
        }
        return durationMs();
    }

    /** Geen geldig bestand (niets geschreven): dan weggooien */
    boolean leeg() {
        return !geschreven || file.length() == 0;
    }

    /** Weggooien zonder af te maken */
    void weg() {
        release();
        //noinspection ResultOfMethodCallIgnored
        file.delete();
    }

    private void drain(boolean totHetEind) {
        MediaCodec.BufferInfo info = new MediaCodec.BufferInfo();
        long tot = System.currentTimeMillis() + 2_000;
        while (true) {
            int out = codec.dequeueOutputBuffer(info, totHetEind ? TIMEOUT_US : 0);
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
                    geschreven = true;
                }
                codec.releaseOutputBuffer(out, false);
                if ((info.flags & MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) return;
            } else if (out == MediaCodec.INFO_TRY_AGAIN_LATER) {
                if (!totHetEind || System.currentTimeMillis() > tot) return;
            }
        }
    }

    private void release() {
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
                // Niets geschreven: geen geldig bestand
                geschreven = false;
            }
            muxer.release();
            muxer = null;
        }
    }
}
