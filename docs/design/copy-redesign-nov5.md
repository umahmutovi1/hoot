# Tekst sa boardova redizajna (5. nov 2026)

Tekst iz Hoot redesign canvasa kojeg nije bilo u `src/locales/bs.json`, sa odlukama iz pregleda 5. nov 2026. Pri implementaciji Sprinta 19 svaki red ide u `bs.json` i `en.json` pod predloženim ključem (ili se koristi navedeni postojeći ključ). Ključevi su prijedlog; prilagodi ih strukturi fajla ako se feature implementira drugačije.

## Izbačeno (ne implementirati)

| Board | Tekst | Zašto |
| --- | --- | --- |
| AiGreske | „Ovo traži nalog. Spasi svoj plan…“ + „Spasi svoj plan“ (`needs_account`) | Nema gost moda, greška ne može nastati |
| GlobalnaStanja | Druga i treća rečenica swipe hinta | Napomena dizajna, ne UI |
| DogadjajIzKalendara | „Učim umjesto ovoga“ | Isto što i Ignoriši |
| DogadjajIzKalendara | Sheet „Je li ovo nastava?“ za svaki novi događaj | AI klasifikuje sam; pitanje samo za serije (`calendarImport.unknown`) |
| PredlosciSesije | Potvrda brisanja predloška | Brisanje odmah + toast sa Poništi |
| DanasKartice | Izmišljena činjenica („Cepeda i sar., 2006“) | Koristi `facts.spacingSessions` |

## Novi ključevi

| Board | Ključ | bs | en | Napomena |
| --- | --- | --- | --- | --- |
| AiGreske | `owl.error.retryLink` | Zalijepi drugi link | Paste another link | |
| AiGreske | `owl.error.retryFile` | Izaberi drugi fajl | Choose another file | |
| AiGreske | `owl.history.short` | Razgovori | Chats | Link nazad |
| UvozStudijskiProgram | `owl.program.nothingSub` | Svi predmeti iz ovog programa su već kod tebe ili isključeni. | Every subject in this programme is already in Hoot or switched off. | |
| UvozStudijskiProgram | `owl.backToChat` | Nazad u chat | Back to chat | |
| UvozStudijskiProgram | `academic.programDetails.have` | Imam plan i program | I have the syllabus | Red pod Akademska godina |
| UvozStudijskiProgram | `academic.programDetails.haveSub` | PDF, slika ili link: asistent ga pročita | PDF, image or link: the assistant reads it | |
| UvozStudijskiProgram | `academic.programDetails.section` | Iz studijskog programa | From the study programme | Naslov sekcije |
| GlobalnaStanja | `offline.banner` | Nisi na mreži. Timer radi, a promjene se šalju kad se veza vrati. | You're offline. The timer works, and changes are sent when you're back online. | |
| GlobalnaStanja | `offline.syncFailed` | Promjene se nisu poslale. Ništa nije izgubljeno, ostaju na telefonu. | Changes weren't sent. Nothing is lost, they stay on your phone. | Stalni banner + „Pokušaj ponovo“ (`progress.statistics.retry`) umjesto toasta `common.saveFailed` |
| GlobalnaStanja | `owl.documents.confirmDeleteTitle` | Obrisati dokument? | Delete document? | |
| GlobalnaStanja | `owl.documents.confirmDelete` (izmjena) | Dokument i odlomci za pretragu brišu se zauvijek. | The document and its search passages are deleted for good. | Nepovratno, pa ostaje sheet |
| GlobalnaStanja | `swipe.hint` | Povuci red ulijevo za radnje. | Swipe a row left for actions. | |
| IzKalendara | `calendarImport.sub` | Predavanja i ispiti iz tvojih kalendara | Lectures and exams from your calendars | Prva rečenica `calendarImport.lead` prelazi u podnaslov |
| IzKalendara | `calendarImport.answeredLecture` | Dodajem u predavanja. Pitam samo jednom. | Adding it to lectures. I only ask once. | |
| IzKalendara | `calendarImport.answeredBusy` | Ostaje samo kao zauzeto vrijeme. | It stays as busy time only. | |
| IzKalendara | `calendarImport.noneSub` | Kad se u povezanim kalendarima pojavi nešto novo, ponudit ću ti ovdje. | When something new shows up in your connected calendars, I'll offer it here. | |
| IzKalendara | `calendarImport.changedSub` | u Hoot-u {{hoot}}, u kalendaru {{calendar}} | {{hoot}} in Hoot, {{calendar}} in your calendar | |
| PredlosciSesije | `settings.presets.builtInHint` | Ugrađeni predlošci se ne uređuju. Za drugačiji ritam napravi vlastiti. | Built-in presets can't be edited. Make your own for a different rhythm. | |
| PredlosciSesije | `settings.presets.deleted` | Predložak je obrisan | Preset deleted | Toast + Poništi |
| ReplanDeficit | `replan.done.hours` | Plan je preračunat. Dodato {{minutes}} min dnevno do {{date}}. | Plan recalculated. Added {{minutes}} min a day until {{date}}. | Treba i varijante za „Smanji obim“ i „Prihvati rizik“ |
| ReplanDeficit | `replan.deficitLine` | {{subject}}: fali {{time}} do ispita | {{subject}}: {{time}} short before the exam | |
| UrediDan | `plan.editDay.more` | Više vremena | More time | |
| UrediDan | `plan.more.free` | {{day}} · slobodno {{free}} | {{day}} · {{free}} free | |
| PredmetUredi | `subjects.form.editSub` | Plan se preračuna kad spasiš. | The plan is recalculated when you save. | |
| PredmetUredi | `subjects.form.conditional` | Uslovni predmet | Required to progress | |
| PredmetUredi | `subjects.form.conditionalSub` | Mora se položiti za upis dalje. Hoot mu daje prednost i više rezerve pred ispit. | Must be passed to enrol further. Hoot gives it priority and more buffer before the exam. | |
| PredmetUredi | `subjects.goal.targetHint.none` | Bez ocjene Hoot planira standardno. | Without a target, Hoot plans as usual. | Bez ocjene = prioritet 3 |
| PredmetUredi | `subjects.goal.targetHint.low` | Za 6 Hoot prvo pokriva najvažnije gradivo. | For a 6, Hoot covers the most important material first. | Prioritet 2 |
| PredmetUredi | `subjects.goal.targetHint.mid` | Za {{grade}} Hoot planira standardno, sa ponavljanjem prije ispita. | For a {{grade}}, Hoot plans as usual, with reviews before the exam. | 7–8, prioritet 3 |
| PredmetUredi | `subjects.goal.targetHint.high` | Za {{grade}} Hoot planira više ponavljanja i cijelo gradivo. | For a {{grade}}, Hoot plans more reviews and all of the material. | 9–10, prioritet 4 |

## Postojeći ključevi umjesto teksta sa boarda

| Board | Tekst na boardu | Koristi |
| --- | --- | --- |
| UvozStudijskiProgram | Fakultet i program | `academic.faculty.title` („Fakultet i godina“) |
| UvozStudijskiProgram | 3. godina · 2026/27 | `academic.found.year` / `academic.faculty.rowValue` |
| GlobalnaStanja | ispit za 12 dana | `subjects.days.inDays_*` uz prefiks „ispit“ |
| IzKalendara | …dok ne pritisneš Primijeni | `calendarImport.lead` („dok ne primijeniš“) |
| DanasKartice | Znaš li? | `today.fact.title` + `facts.spacingSessions` |
| UrediDan | Maksimum | `availability.cap` („Najviše učenja“) |
| PredmetUredi | (nije obavezno) | `subjects.goal.optional` („(opcionalno)“) |
| PredmetUredi | Roze | `subjects.color.pink` („Roza“) |
