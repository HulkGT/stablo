# Rodoslov — Einrichtung

Drei Schritte. Danach läuft die App und alle sehen dieselben Einträge.

---

## 1. Gemeinsamen Speicher anlegen (Supabase, kostenlos)

1. Auf **supabase.com** gehen, **Start your project**, mit GitHub anmelden.
2. **New project**. Name egal, zum Beispiel `rodoslov`. Region **Frankfurt (eu-central-1)**.
   Das Datenbank-Passwort irgendwo notieren, du brauchst es hier nicht weiter.
3. Zwei Minuten warten, bis das Projekt bereit ist.
4. Links auf **SQL Editor**, dann **New query**. Folgendes hineinkopieren und auf **Run** klicken:

```sql
create table public.tree (
  id int primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.tree (id, data) values (1, '{}'::jsonb);

alter table public.tree enable row level security;

create policy "svi citaju"  on public.tree for select using (true);
create policy "svi pisu"    on public.tree for update using (true) with check (true);
```

5. Links auf **Project Settings → API**. Dort stehen zwei Werte:
   - **Project URL**, sieht aus wie `https://abcdefghijkl.supabase.co`
   - **anon public** key, ein langer Text
6. Diese beiden Werte in die Datei **config.js** eintragen:

```js
window.CFG = {
  url:   'https://abcdefghijkl.supabase.co',
  key:   'eyJhbGciOi...',
  table: 'tree'
};
```

Der anon-Key darf öffentlich sein. Er erlaubt genau das, was die Regeln oben zulassen:
diese eine Tabelle lesen und schreiben. Mehr nicht.

---

## 2. Auf GitHub stellen

1. Auf GitHub **New repository**, Name **rodoslov**, Public, **Create**.
2. **uploading an existing file**, alle Dateien aus dem ZIP hineinziehen —
   auch den Ordner `photos` — dann **Commit changes**.
3. **Settings → Pages**, bei Branch **main** und **/ (root)** wählen, **Save**.
4. Nach ein bis zwei Minuten ist die Adresse da:
   **https://hulkgt.github.io/stablo/**

Wenn du das Repo anders nennst, musst du in `index.html` die drei Zeilen mit
`og:url` und `og:image` auf die neue Adresse ändern, sonst zeigt WhatsApp kein Vorschaubild.

---

## 3. An die Familie schicken

Den Link mit ein paar eigenen Worten schicken, nie nackt. Zum Beispiel:

> Bok! Ovo je naše obiteljsko stablo, složio sam ga sam.
> Otvori link, dodirni veliki gumb i stablo ti stoji na ekranu kao aplikacija.
> Možeš dodati svoju djecu, godine i fotografije — svi to odmah vide.
> Ako nešto ne radi, zovi me.
>
> https://hulkgt.github.io/stablo/

Beim Antippen erkennt die App selbst, in welchem Browser sie steckt:
In Chrome und am PC kommt ein Installieren-Knopf, aus WhatsApp heraus ein Knopf
„In Chrome öffnen", auf dem iPhone die Zwei-Schritt-Anleitung für Safari.

---

## Was die Verwandten tun können

Person antippen → Listić mit vier Knöpfen:

- **Dodaj partnera** — Ehepartner anlegen
- **Dodaj dijete** — Kind anlegen
- **Dodaj roditelja** — Vater oder Mutter ergänzen, auch über den ältesten Vorfahren hinaus
- **Uredi** — Name, Jahre, Notiz, Foto ändern oder die Person löschen

Fotos werden auf dem Handy verkleinert, bevor sie gespeichert werden.
Ohne Internet wird auf dem Gerät gespeichert und beim nächsten Öffnen nachgeschickt.

## Sicherheit, ehrlich gesagt

Wer die Adresse hat, kann eintragen **und** löschen. Das war deine Vorgabe.
Zwei Dinge, die du wissen solltest:

- Supabase legt automatisch tägliche Sicherungen an (kostenloses Konto: 7 Tage zurück).
- Wenn der Link doch einmal zu weit wandert, sag Bescheid — ein vierstelliger
  Familiencode vor dem Bearbeiten ist schnell eingebaut.

## Änderungen später

Die App besteht aus einfachen Dateien. Wenn du etwas geändert haben willst,
schick mir die Datei oder sag mir, was anders soll.
