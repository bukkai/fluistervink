package nl.hegmus.fluistervink;

/**
 * Wanneer een trektelling knipt, en of er spraak in een stuk zit: dezelfde
 * regels als `createChunker` in src/lib/trektel.ts, voor de trektelling in de
 * service (TrektelOpname). De getallen komen van de webcode (CHUNK_OPTIONS),
 * zodat ze maar op één plek staan. Houd de twee gelijk; KnipperTest loopt
 * dezelfde gevallen na als trektel.test.ts.
 */
final class Knipper {

    static final class Opties {
        /** Na zo lang knippen bij de eerstvolgende pauze */
        long doelMs = 60_000;
        /** Zo lang stil = een pauze */
        long pauzeMs = 700;
        /** Zonder pauze hoe dan ook knippen */
        long maxMs = 180_000;
        /** Minder spraak dan dit = stilte, niet versturen */
        long minSpraakMs = 300;
        /** Zoveel dB boven het achtergrondgeluid = spraak */
        double margeDb = 10;
        /** Zachter dan dit is nooit spraak (dBFS) */
        double vloerDb = -60;
    }

    /** Eén stuk, zoals `Cut` in trektel.ts */
    static final class Stuk {
        long duurMs;
        long spraakMs;
        boolean heeftSpraak;
        long piekDb;
        long achtergrondDb;
    }

    /** Hoe snel het achtergrondniveau mag stijgen, in dB per meting (zoals FLOOR_RISE_DB) */
    private static final double STIJGING_DB = 0.05;
    /** Stiller dan dit telt als dit niveau (zoals MIN_LEVEL_DB) */
    private static final double MIN_DB = -100;

    private final Opties opties;
    private long duurMs = 0;
    private long spraakMs = 0;
    private long stilMs = 0;
    private double piekDb = Double.NEGATIVE_INFINITY;
    private Double achtergrondDb = null;
    private boolean spreekt = false;

    Knipper(Opties opties) {
        this.opties = opties;
    }

    /** Of de laatste meting spraak was */
    boolean spreekt() {
        return spreekt;
    }

    /** Eén meting; geeft een stuk terug als het hier eindigt. */
    Stuk meet(double gemetenDb, long frameMs) {
        double niveau = Math.max(gemetenDb, MIN_DB);
        achtergrondDb = achtergrondDb == null || niveau < achtergrondDb ? niveau : achtergrondDb + STIJGING_DB;
        spreekt = niveau > opties.vloerDb && niveau > achtergrondDb + opties.margeDb;

        duurMs += frameMs;
        piekDb = Math.max(piekDb, niveau);
        if (spreekt) {
            spraakMs += frameMs;
            stilMs = 0;
        } else {
            stilMs += frameMs;
        }

        boolean pauze = duurMs >= opties.doelMs && stilMs >= opties.pauzeMs;
        if (!pauze && duurMs < opties.maxMs) return null;
        return klaar();
    }

    /** Het laatste stuk, bij stoppen of pauzeren. */
    Stuk klaar() {
        Stuk stuk = new Stuk();
        stuk.duurMs = duurMs;
        stuk.spraakMs = spraakMs;
        stuk.heeftSpraak = spraakMs >= opties.minSpraakMs;
        stuk.piekDb = Math.round(piekDb);
        stuk.achtergrondDb = Math.round(achtergrondDb == null ? Double.NEGATIVE_INFINITY : achtergrondDb);
        duurMs = 0;
        spraakMs = 0;
        stilMs = 0;
        piekDb = Double.NEGATIVE_INFINITY;
        return stuk;
    }

    /** Niveau van 16-bit samples (little endian) in dBFS, zoals `levelDb` in trektel.ts. */
    static double niveauDb(byte[] pcm, int lengte) {
        double som = 0;
        int aantal = lengte / 2;
        for (int i = 0; i + 1 < lengte; i += 2) {
            double sample = (short) ((pcm[i] & 0xff) | (pcm[i + 1] << 8)) / 32768.0;
            som += sample * sample;
        }
        double rms = Math.sqrt(som / Math.max(aantal, 1));
        return rms > 0 ? 20 * Math.log10(rms) : Double.NEGATIVE_INFINITY;
    }

    /** Alleen nullen: Android geeft ons stilte (een andere app of een gesprek heeft de microfoon) */
    static boolean alleenNullen(byte[] pcm, int lengte) {
        for (int i = 0; i < lengte; i++) if (pcm[i] != 0) return false;
        return true;
    }
}
