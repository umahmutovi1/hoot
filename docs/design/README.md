# Dizajn (referenca za implementaciju)

Svaki `.dc.html` fajl je jedan ekran (390 px širine, mobilni). Ovo su **mockupi, ne produkcijski kod**:
čitaj ih za raspored, boje, tipografiju, tekstove i tokove, a implementiraj u React + Tailwind.
Logika u `<script>` bloku na dnu fajla je samo demo interakcija.

## Vizuelni sistem
- Font: Outfit (400/500/600/700)
- Pozadina #F1EFF7, kartice #FFFFFF, tekst #1D1A2B, sekundarni tekst #5B5670
- Primarna #4B3B8F, akcent #7C6BD6, svijetla lavanda #E9E4FB
- Predmeti: roza #C026B0 / #FBE3F6, lavanda #7C6BD6 / #E9E4FB, plava #2563EB / #E3EDFD
- Status: zelena #1F6B5A / #DCEFEA, narandžasta (upozorenje) #9A4B0B / #FDEBD3
- Jačina znanja (skala): 85%+ #2E9E6A, 75–84% #8DBF5A, 60–74% #E0B23A, ispod 60% #E08A2C
- Zaobljenja: kartice 24–28 px, dugmad i čipovi pune pilule, inputi 18 px
- Touch target najmanje 44 px; ikone su stroke SVG 1.8 px

## Ekrani po toku
- Tab ekrani (sa donjom navigacijom): Danas, Plan, Satnica, Predmeti, Napredak
- Prazna stanja "Danas": DanasPrazno (prvi ulazak), DanasSlobodno (dan bez plana)
- Sesija: PokreniSesiju → Sesija → KrajSesije → RecallGate
- Provjera znanja: ProvjeraZnanja → ProvjeraSazetak (ulaz: kartica na Danas, Predmet, Napredak)
- Plan: Plan (kalendar), Satnica, Replan, Dostupnost, Raspored
- Ručni blokovi (bottom sheet, 3 stanja): UrediBlokNovi, UrediBlokUredi, UrediBlokObrisi
- Predmeti: Predmeti, Predmet (redovno), PredmetKampanja, NoviPredmet (Napredno sklopljeno), NoviPredmetNapredno (otvoreno), Izvor, Jedinica
- Predavanja: DokleSmoStigli (bottom sheet; ulaz: kartica na Danas i Predmet)
- Uvoz: DodajIzvor → Parsiranje → ObimIspita
- Ostalo: Postavke, Prijava
- Bodovi i ocjene (Etapa 5): `BodoviOcjene.html` — jedan statičan fajl sa 6 ekrana (kartica na Predmetu, ispiti sa rezultatom i popravnim, polja bodova u ExamSheetu, sheet Rezultat, sheet Skala ocjena, Napredak → Ocjene). Dugmad pišu „Spasi“.
- Sova agent (Etapa 6): `SovaAgent.html` — traka sa sovom na dnu Danas, razgovor sa citatom iz dokumenta, „Daj sovi dokument“, prijedlog uvoza kao kartica, offline traka, prazno stanje; varijanta za sve tabove (za kasnije).
- Zaglavlja tab ekrana: `Zaglavlja.html` — prvi red samo naslov lijevo i mali avatar desno (otvara Postavke), sve ostalo u redu ispod.

Maskota: vidi MASCOT.md.

Donja navigacija (odstupa od mockupa, odluka nakon Etape 2): plutajuća poluprozirna pilula sa blurom, samo ikone
(Danas, Plan, Predmeti, Napredak), aktivni tab ima svijetloljubičastu pilulu iza ljubičaste ikone. Timer dugme je ljubičasti krug u sredini pilule. Mockupi još prikazuju staru traku sa urezom.

Odstupanja nakon Etape 4: kalendar ima samo Mjesec i Dan; Dostupnost je sedmica sa datumima i vremenskom osom (umjesto liste po danu iz `Dostupnost.dc.html`); svaki bottom sheet ima × za zatvaranje.

Odstupanja nakon Etape 5: Dostupnost nema sekcije „Sedmični šablon“, „Izmijenjeni dani“ ni karticu „Raspored nastave“ iz `Dostupnost.dc.html`. „Uredi dan“ nudi „Samo ovaj dan / Svaki <dan>“, a nastava se vidi na vremenskoj osi (osa je samo za čitanje, ne otvara sheet). Raspored je dostupan s Plana i Predmeta. Bottom sheet pri otvaranju ne fokusira prvo polje, da se na mobilnom ne otvori native time picker.

Odstupanja nakon Etape 6: iznad trake sove nema oblačića sa savjetom (dolazi sa strategistom u Etapi 11), samo prijedlozi; iza trake je blagi fade da lista ispod ne smeta. „Daj sovi dokument“ ne šalje odmah: nakon izbora fajla ili lijepljenja teksta sheet pokaže prilog (sličica, naziv, veličina, „Promijeni“), polje „Poruka sovi“ (nije obavezno, npr. „samo II godina“), vrstu i dugme „Daj sovi“; poruka se vidi uz fajl u razgovoru. Razgovor ima i dugme „Očisti razgovor“ (kanta) pored ×. „Pregledaj“ otvara ekran „Pregled uvoza“ (prekidač „Uključi“ po stavci, izmjena datuma i vremena, izbor predmeta za „preskačem“) sa „Spasi N“ na dnu. Dokumenti su u Postavkama (lista → dokument sa tekstom po stranicama, „Otvori fajl“, „Obriši dokument“); tap na citat otvara fajl na toj stranici.

Varijante istog ekrana (npr. UrediBlok*, Provjera*, NoviPredmet*) su jedna komponenta sa stanjem, ne zasebne stranice.
