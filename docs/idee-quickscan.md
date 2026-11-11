# Idee: een app voor ecologische quickscans

Ontwerpschets van 11 nov 2026, nog geen plan. Mogelijk de eerstvolgende app op de basis van Fluistervink (zie NOTES.md, Ideeën voor later). Gebaseerd op vier gesprekken waarin de eigenaar tijdens een quickscan zijn veldwerk insprak tegen Claude (september en oktober 2026): een stationsomgeving, een spoortraject, een kabeltracé tussen twee percelen en een spoortunnel met twee veldbezoeken. Projectgegevens staan hier bewust niet in; die zijn van de opdrachtgevers.

## Hoe het nu gaat

1. **In het veld** loopt de ecoloog het gebied rond en spreekt alles in: soorten, bomen, gebouwen, sporen, oordelen ("potentieel geschikt voor vleermuizen") en losse context ("hier wordt niet gegraven"). Door elkaar in het Nederlands, Engels en Latijn, vaak in lange stukken, via het dicteren van de telefoon. Claude houdt per plek een lijst bij, helpt bij het determineren en geeft op een keerpunt een checklist van wat nog te bekijken is.
2. **Na het veld** vraagt de ecoloog lijsten voor de veldkaart in QGIS (in alle vier de gesprekken, soms twee keer), het weer en de tijd van het bezoek, en de plek van een bepaalde soort.
3. **Bij het schrijven** (weken later) gaan de vragen over de eigen veldgegevens ("welke planten stonden bij perceel X?", "wat wees op zoogdieren?", "waren er waardplanten van soort Y?") en helpt Claude per paragraaf van het rapport.

Wat daarbij misgaat, en wat een app kan voorkomen:

- **Plekken worden met woorden beschreven** ("noordkant, binnen het hek, voet van het heuveltje", "stalling 1, die later deelgebied 3 heet"), en met schermafdrukken van de kaart om te laten zien waar de ecoloog stond. Nummers veranderen een paar keer.
- **Wat niet verstaan is, verdwijnt.** Slecht verstane woorden ("kruispin", "wilde pijn") liet Claude weg; weken later wist niemand meer wat er bedoeld was.
- **De plek van een exoot ontbrak** toen de opdrachtgever erom vroeg.
- **Foto's raakten los van hun plek** en werden bij het verkeerde perceel besproken.
- **Het weer** werd te laat of niet ingesproken.
- **Claude vulde aan wat niet gezegd was:** een soort op een foto, een opmerking uit een ander project, een determinatie die heen en weer ging.
- **Aantallen in het rapport klopten niet** met het veldwerk (drie of vier bomen).
- **Iets werd vergeten** (struiken niet benoemd), en dat bleek pas bij het schrijven.
- **Een waardplant van een beschermde soort** werd pas bij het schrijven herkend als relevant, toen er niet meer op rupsen of vraatsporen gelet kon worden.

## Wat de app vastlegt

### Project en bezoek

- Een **project** heeft een of meer **bezoeken** (in Fluistervink: sessies). Lijsten en kaart voegen de bezoeken samen.
- Per bezoek automatisch: datum, begin- en eindtijd, **weer** (temperatuur, bewolking, wind in Beaufort, windrichting) uit een weerdienst, aan te passen met de stem ("het waait hier eerder 4 tot 5").
- **Route** van het bezoek: anders dan in Fluistervink hoort die erbij, want een quickscan moet laten zien waar de ecoloog is geweest.
- **Plekindeling**, op drie manieren:
  - deelgebieden uit de plangebieden in QGIS (GeoJSON of GeoPackage importeren); de app weet bij elke uitspraak in welk deelgebied je staat en of iets binnen of buiten het plangebied valt;
  - hectometers langs het spoor (eventueel uit open data);
  - vrij, met de GPS-positie als enige plek, achteraf op de kaart in te delen.
- Hernummeren of hernoemen van deelgebieden is alleen een naam veranderen.

### Waarnemingen, vier soorten

1. **Soort** (alle soortgroepen):
   - Aantal: exact, schatting ("zeker 100"), bereik ("enkele honderden, max duizend") of alleen aanwezig.
   - Zekerheid: zeker, twijfel tussen kandidaten ("kleine of slipbladige ooievaarsbek"), alleen het geslacht ("zuring sp."), of onbekend met een omschrijving ("middelgrote gele libel, onbekend gelaten"). Later te bevestigen, ook met terugwerkende kracht ("dat bevestigt ook de waarneming aan de andere kant").
   - Gedrag en methode: overvliegend, roepend, zingend, ter plaatse, gezien of gehoord.
   - Plantenlijsten in één adem ("brandnetel, haagwinde, stinkende gouwe, …") worden losse waarnemingen op dezelfde plek.
2. **Object** met eigenschappen, als punt, lijn of vlak op de kaart:
   - boom of struik: soort, aantal, stamdiameter, hoogte, kroon, onderlinge afstand, holtes, spleten, loszittende schors, nesten;
   - heg of haag: soort, hoogte, breedte, lengte, dichtheid;
   - gebouw of kunstwerk: dakrand, dakpannen, open stootvoegen, kieren, spouw, zonnepanelen;
   - strook, verbinding of looproute (egel, marterachtigen), water of sloot (watervoerend, oever), verlichting, put of sleuf.
3. **Spoor**: uitwerpselen (grootte, inhoud zoals haren of bessen, vers of oud, plek), holen, prenten, karkassen, nesten.
4. **Oordeel of notitie**: geschiktheid ("potentieel geschikt voor vleermuizen, geen holtes zichtbaar vanaf maaiveld"), typering van de vegetatie ("voedselrijke, grazige berm, niets bijzonders"), context van de ingreep ("hier wordt niet gegraven", "uitgaan van het ergste geval").

Elke waarneming heeft tijd, GPS-positie en bron-uitspraak, zoals in Fluistervink, plus een label **binnen of buiten de ingreep**. Dat label is achteraf te veranderen: de ingreep veranderde in de gesprekken meer dan eens nadat het veldwerk gedaan was, dus de app legt alles vast en beoordeelt niet bij het inspreken.

### Foto's

Gekoppeld aan tijd en GPS, en daarmee aan de plek en de waarnemingen in de buurt. Determinatie-apps (PlantNet, ObsIdentify) blijven daarnaast; hun uitkomst kan als notitie bij de waarneming.

## Statustabel

Bij elke soort zet de app zelf, uit een vaste tabel met bron en datum, en niet uit het model:

- beschermingsregime (Habitatrichtlijn, Vogelrichtlijn, jaarrond beschermd nest, andere soorten of vrijgesteld, per provincie);
- Rode Lijst;
- exoot, en of hij op de Unielijst staat;
- **waardplant van een beschermde soort** (teunisbloem en wilgenroosje voor de teunisbloempijlstaart, en dergelijke).

Dat laatste ook in het veld, met een eigen trilpatroon of een gesproken zin: "teunisbloem: waardplant van de teunisbloempijlstaart, let op rupsen en vraatsporen".

## In het veld

- **Bevestiging** zoals in Fluistervink (trillen), eventueel gesproken in de oortjes.
- **"Wat moet ik nog checken?"** In alle vier de gesprekken gevraagd, op een pauze of voor de terugweg. De app maakt een checklist per plek uit wat er al vastgelegd is en wat de ingreep is: bomen zonder beoordeling van holtes, gebouwen zonder dakrand, struiken zonder soort, het weer als dat nog ontbreekt. Gesproken, af te vinken met de stem.
- **Hulp bij determineren** in een paar zinnen (zomereik of wintereik, dwergmeeuw of kokmeeuw). Wat het model voorstelt, staat apart van wat de ecoloog zegt, en wordt pas een waarneming als de ecoloog het bevestigt.
- **Correcties met de stem**, zoals in Fluistervink ("nee, het was toch teunisbloem", "maak daar maar enkele honderden van").

## Spraak

- Nederlands, Engels en Latijn door elkaar, met veel verkeerd verstane namen ("Hermes" voor heggenmus, "Fractionless Excelsior" voor *Fraxinus excelsior*).
- De hele soortenlijst past niet in de prompt van de spraakherkenning of van het model. Voorstel: in de prompt van de spraakherkenning de algemene soorten per soortgroep plus wat al eerder in het project genoemd is; het model geeft de gezegde naam door en de app zoekt hem op (zoals `findVagrant` in Fluistervink, met speling, bijnamen, Engelse en Latijnse namen).
- De opname blijft bewaard. Een uitspraak die niet (helemaal) begrepen is, wordt een onzekere notitie met de opname erbij, en verdwijnt nooit.

## Na het veld

- Lijsten per plek, per soortgroep en per bezoek, of samengevoegd over bezoeken.
- Export naar QGIS (GeoJSON of GeoPackage, in RD New) voor de veldkaart: punten, lijnen en vlakken met de eigenschappen.
- Export naar waarneming.nl (zoals in Fluistervink), zodat soorten niet dubbel ingevoerd worden.
- Doorgeven aan een collega zonder de app (een bestand of een link).
- Vragen aan de eigen gegevens ("wat wees op zoogdieren?") worden een filter of een zoekvraag.
- Het rapport schrijven blijft werk met Claude, maar dan met een export van het project als bron, geordend zoals het rapport (vleermuizen, vogels, grondgebonden zoogdieren, amfibieën en reptielen, flora, ongewervelden, zorgplicht, exoten, houtopstanden), in plaats van een chatgeschiedenis.

## Hergebruik uit Fluistervink

Opname en wachtrij (local-first), spraakherkenning met een prompt, interpretatie met tools, GPS met warme positie, plek met de stem, correcties, nalopen met kaart, onzekere waarnemingen één voor één, trilpatronen en gesproken bevestiging, de proxy met kostenbewaking, de testset, export naar waarneming.nl.

Voorstel: een tweede app in dezelfde repo, met de gedeelde code in `src/lib`. Pas een apart pakket als dat ergens knelt.

## Anders dan in Fluistervink

- **Route wel bewaren** (zie Project en bezoek).
- **Vertrouwelijk:** gebied, locaties en opdrachtgever zijn van de opdrachtgever. Delen met de ontwikkelaar staat standaard uit, met een eigen `#privacy`.
- **Professioneel gebruik:** mogelijk betaald, en dan accounts. Nog te beslissen.

## Volgorde (voorstel)

1. **Fluistervink voor alle soortgroepen:** project en bezoek, weer, GPS en route, soorten met aantallen als bereik en twijfel tussen kandidaten, plekken als hectometer of vrij, lijsten als export. Dit dekt het spoortraject al grotendeels.
2. **Plangebieden en objecten:** GeoJSON importeren, deelgebied per uitspraak, objecten, sporen, oordelen, export naar QGIS.
3. **Statustabel en checklist:** status bij elke soort, waardplanten in het veld, de gesproken checklist.
4. **Foto's en rapport:** foto's op tijd en plek, export per hoofdstuk van het rapport.

## Open vragen

- Waar komen de soortenlijsten van alle soortgroepen vandaan? Waarneming.nl heeft regiolijsten per soortgroep met dezelfde ID's; nagaan.
- Waar komt de statustabel vandaan, en hoe blijft hij bij (wetgeving, Rode Lijsten, Unielijst)?
- Hectometers uit open data: welke bron?
- Welke weerdienst, en welk station (het dichtstbijzijnde KNMI-station of een model)?
- Testset: de vier gesprekken hebben geen opnames, alleen tekst. Daarmee is de interpretatie te testen, niet de spraakherkenning. Voor de spraakherkenning zijn opnames uit een echte quickscan nodig.
- Toets: de uiteindelijke rapporten naast de gegevens leggen die de app zou vastleggen. Staat alles wat in het rapport komt erin?
