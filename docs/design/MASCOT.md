# Maskota (sova)

Fajlovi za app su u `public/mascot/`: `<ime>.webp` (160 px) i `<ime>@2x.webp` (320 px).
PNG originali su u `docs/design/assets/mascot/` (izvor, ne koristi ih direktno u app-u).
Najveći oštri prikaz je 160 px CSS (320 px fizički).

Koristi uvijek isti `<Mascot pose="reading" size={120} />` komponent:
`<img src="/mascot/${pose}.webp" srcSet="/mascot/${pose}@2x.webp 2x" width={size} height={size} alt="" />`
(alt prazan kad je dekorativna; opisni alt samo na Prijavi i praznim stanjima).

| Poza | Gdje | Veličina | Ekran u dizajnu |
| --- | --- | --- | --- |
| `reading` | Prijava, ilustracija u krugu na vrhu | 220 px u krugu 260 px | Prijava.dc.html |
| `reading` | "Danas" prvi ulazak (nema predmeta) | 190 px u krugu 220 px | DanasPrazno.dc.html |
| `sleeping` | "Danas" bez blokova (slobodan dan) i offline poruka | 190 px u krugu 220 px | DanasSlobodno.dc.html |
| `timer` | Sheet "Šta učiš sad?" (timer dugme) | 84 px, lijevo od naslova | PokreniSesiju.dc.html |
| `celebrating` | Kraj sesije, umjesto kvačice | 140 px, centrirano | KrajSesije.dc.html |
| `celebrating` | Položen ispit / unesen rezultat (toast ili modal) | 120 px | — (isti stil kao KrajSesije) |
| `celebrating` | Sažetak provjere znanja | 120 px, centrirano | ProvjeraSazetak.dc.html |
| `reading-head` | Avatar strategista: savjet na "Danas" i sedmični pregled | 52 px | Danas.dc.html, Napredak.dc.html |
| `sleeping-head` | Replan sheet "Plan je ažuriran" (propušten blok) | 76 px, gore desno | Replan.dc.html |
| `celebrating-head` | Web Push notifikacije (ikona), recall gate "Sjećam se" potvrda | 48–72 px | — |
| `timer-head` | Notifikacija "blok počinje", prazno stanje Satnice | 48–96 px | — |

Pravila: najviše jedna sova po ekranu; ne koristiti je na listama ni u tab baru;
ne mijenjati boje slike (već je usklađena sa paletom #7C6BD6 / #E9E4FB).
