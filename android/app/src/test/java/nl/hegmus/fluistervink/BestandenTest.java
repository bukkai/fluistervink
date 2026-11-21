package nl.hegmus.fluistervink;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import org.junit.Test;

/** Regels voor de opnamebestanden van de service (Bestanden). */
public class BestandenTest {

    @Test
    public void sessieIdIsEenUuid() {
        assertTrue(Bestanden.geldigSessieId("b391b051-a3e4-4fa8-a971-dcb4f45697e9"));
        assertTrue(Bestanden.geldigSessieId("onbekend"));
    }

    @Test
    public void sessieIdZonderTekensDieDeNaamBreken() {
        assertFalse(Bestanden.geldigSessieId(null));
        assertFalse(Bestanden.geldigSessieId(""));
        // `_` scheidt de delen van de naam; `/` en `..` gaan buiten de map
        assertFalse(Bestanden.geldigSessieId("a_b"));
        assertFalse(Bestanden.geldigSessieId("../x"));
        assertFalse(Bestanden.geldigSessieId("a/b"));
        assertFalse(Bestanden.geldigSessieId("a".repeat(65)));
    }

    @Test
    public void ruimtAlleenHalveBestandenOp() throws IOException {
        File map = Files.createTempDirectory("scherm-uit").toFile();
        File half = new File(map, "opname.tmp");
        File stuk = new File(map, "trektel-1763700000000.tmp");
        File af = new File(map, "sessie_1763700000000_4200.m4a");
        File afTrektel = new File(map, "sessie_1763700000000_60000_trektel.m4a");
        for (File file : new File[] { half, stuk, af, afTrektel }) assertTrue(file.createNewFile());

        assertEquals(2, Bestanden.ruimOp(map));
        assertFalse(half.exists());
        assertFalse(stuk.exists());
        // Afgemaakte opnames wachten op de webcode (`wachtend`)
        assertTrue(af.exists());
        assertTrue(afTrektel.exists());
    }

    @Test
    public void ruimOpZonderMap() {
        assertEquals(0, Bestanden.ruimOp(new File("bestaat-niet-" + System.nanoTime())));
    }
}
