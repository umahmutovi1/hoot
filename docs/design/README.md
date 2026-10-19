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

Maskota: vidi MASCOT.md.

Donja navigacija: bijela traka sa zaobljenim vrhom i urezom u sredini za plutajuće timer dugme (bez sjene);
aktivni tab ima svijetloljubičastu pilulu iza ikone.

Varijante istog ekrana (npr. UrediBlok*, Provjera*, NoviPredmet*) su jedna komponenta sa stanjem, ne zasebne stranice.
