package nl.hegmus.fluistervink;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.util.ArrayList;
import java.util.List;
import org.junit.Test;

/**
 * Dezelfde gevallen als `createChunker` in src/lib/trektel.test.ts: de
 * trektelling in de service moet net zo knippen als die in de webcode.
 * Draaien met `./gradlew testDebugUnitTest` (in android/).
 */
public class KnipperTest {

    private static final double STIL = -70;
    private static final double WIND = -40;
    private static final double STEM = -20;
    private static final long FRAME = TrektelOpname.FRAME_MS;

    private static List<Knipper.Stuk> voer(Knipper knipper, double db, long ms) {
        List<Knipper.Stuk> stukken = new ArrayList<>();
        for (long t = 0; t < ms; t += FRAME) {
            Knipper.Stuk stuk = knipper.meet(db, FRAME);
            if (stuk != null) stukken.add(stuk);
        }
        return stukken;
    }

    /** Woorden met korte dipjes ertussen */
    private static List<Knipper.Stuk> praat(Knipper knipper, long ms) {
        List<Knipper.Stuk> stukken = new ArrayList<>();
        for (long t = 0; t < ms; t += 500) {
            stukken.addAll(voer(knipper, STEM, 400));
            stukken.addAll(voer(knipper, STIL, 100));
        }
        return stukken;
    }

    @Test
    public void knipt_niet_voor_de_doeltijd() {
        Knipper knipper = new Knipper(new Knipper.Opties());
        assertTrue(voer(knipper, STIL, 1000).isEmpty());
        assertTrue(praat(knipper, 2000).isEmpty());
        assertTrue(voer(knipper, STIL, 5000).isEmpty());
    }

    @Test
    public void knipt_na_de_doeltijd_bij_een_pauze() {
        Knipper.Opties opties = new Knipper.Opties();
        Knipper knipper = new Knipper(opties);
        voer(knipper, STIL, 1000);
        assertTrue(praat(knipper, 60_000).isEmpty());
        assertTrue(voer(knipper, STIL, 400).isEmpty());
        assertTrue(praat(knipper, 2000).isEmpty());
        List<Knipper.Stuk> stukken = voer(knipper, STIL, opties.pauzeMs);
        assertEquals(1, stukken.size());
        Knipper.Stuk stuk = stukken.get(0);
        assertTrue(stuk.heeftSpraak);
        assertEquals(1000 + 60_000 + 400 + 2000 + 600, stuk.duurMs);
        assertEquals((long) (62_000 * 0.8), stuk.spraakMs);
    }

    @Test
    public void knipt_na_het_maximum_zonder_pauze() {
        Knipper.Opties opties = new Knipper.Opties();
        Knipper knipper = new Knipper(opties);
        voer(knipper, STIL, 500);
        List<Knipper.Stuk> stukken = praat(knipper, opties.maxMs);
        assertEquals(1, stukken.size());
        assertEquals(opties.maxMs, stukken.get(0).duurMs);
    }

    @Test
    public void alleen_stilte_heeft_geen_spraak() {
        Knipper knipper = new Knipper(new Knipper.Opties());
        Knipper.Stuk stuk = voer(knipper, STIL, 61_000).get(0);
        assertFalse(stuk.heeftSpraak);
        assertEquals(0, stuk.spraakMs);
    }

    @Test
    public void kort_woord_telt_als_spraak() {
        Knipper knipper = new Knipper(new Knipper.Opties());
        voer(knipper, STIL, 2000);
        voer(knipper, STEM, 300);
        voer(knipper, STIL, 2000);
        assertTrue(knipper.klaar().heeftSpraak);
    }

    @Test
    public void aanhoudende_wind_telt_na_een_tijdje_niet() {
        Knipper knipper = new Knipper(new Knipper.Opties());
        voer(knipper, STIL, 1000);
        voer(knipper, WIND, 2000);
        assertTrue(knipper.spreekt());
        voer(knipper, WIND, 60_000);
        assertFalse(knipper.spreekt());
        voer(knipper, STEM, 100);
        assertTrue(knipper.spreekt());
    }

    @Test
    public void eerste_meting_met_alleen_nullen_bederft_het_achtergrondniveau_niet() {
        Knipper knipper = new Knipper(new Knipper.Opties());
        assertNull(knipper.meet(Double.NEGATIVE_INFINITY, FRAME));
        // Vanaf -100 dB stijgt het achtergrondniveau 0,5 dB per seconde: na
        // ruim twee minuten wind telt die niet meer als spraak (met -Infinity nooit)
        voer(knipper, WIND, 130_000);
        assertFalse(knipper.spreekt());
    }

    @Test
    public void niveau_en_nullen() {
        byte[] stil = new byte[3200];
        assertEquals(Double.NEGATIVE_INFINITY, Knipper.niveauDb(stil, stil.length), 0);
        assertTrue(Knipper.alleenNullen(stil, stil.length));
        // Volle schaal (32767) ≈ 0 dBFS
        byte[] hard = new byte[3200];
        for (int i = 0; i < hard.length; i += 2) {
            hard[i] = (byte) 0xff;
            hard[i + 1] = (byte) 0x7f;
        }
        assertEquals(0, Knipper.niveauDb(hard, hard.length), 0.01);
        assertFalse(Knipper.alleenNullen(hard, hard.length));
        assertNotNull(new Knipper.Opties());
    }
}
