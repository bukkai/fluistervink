package nl.hegmus.fluistervink;

import java.io.File;
import java.util.regex.Pattern;

/**
 * Regels voor de opnamebestanden van de service (map "scherm-uit", zie
 * WandelingService.directory). Los van Android, zodat ze te testen zijn
 * (BestandenTest).
 */
final class Bestanden {

    /** Een sessie-id van de webcode is een UUID; alleen letters, cijfers en streepjes */
    private static final Pattern SESSIE_ID = Pattern.compile("[A-Za-z0-9-]{1,64}");

    private Bestanden() {}

    /**
     * Mag dit sessie-id in een bestandsnaam? De naam is
     * `<sessieId>_<startedAt>_<durationMs>.m4a`: een `_` erin maakt hem
     * onleesbaar (het bestand komt nooit bij de webcode en blijft liggen), een
     * `/` zet hem buiten de map.
     */
    static boolean geldigSessieId(String id) {
        return id != null && SESSIE_ID.matcher(id).matches();
    }

    /**
     * Halve bestanden van een opname of trektelstuk die niet afkwam (app of
     * telefoon viel uit midden in een opname). Die worden nooit meer
     * afgemaakt of doorgegeven.
     */
    static boolean halfAf(String naam) {
        return naam.endsWith(".tmp");
    }

    /** Halve bestanden weggooien; geeft hoeveel. Alleen als er niets opneemt. */
    static int ruimOp(File map) {
        File[] files = map.listFiles((dir, naam) -> halfAf(naam));
        if (files == null) return 0;
        int weg = 0;
        for (File file : files) {
            if (file.delete()) weg++;
        }
        return weg;
    }
}
