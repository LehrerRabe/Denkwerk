/* Denkwerk – Zusatzaufgaben für schnelle Rechenköpfe
   Reines HTML/JS ohne Server. Fortschritt liegt im Browser des Geräts (localStorage). */
(function () {
  "use strict";

  var D = window.DENKWERK;
  var SPEICHER_KEY = "denkwerk.v1";
  var PASSWORT_HASH = "46ecc8df";

  // ------------------------------------------------------------ Hilfsfunktionen
  function $(sel, el) { return (el || document).querySelector(sel); }
  function h(tag, attrs, kinder) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === "class") el.className = v;
        else if (k === "html") el.innerHTML = v;
        else if (k === "text") el.textContent = v;
        else if (k.indexOf("on") === 0) el.addEventListener(k.slice(2), v);
        else if (k === "style") el.setAttribute("style", v);
        else el.setAttribute(k, v === true ? "" : v);
      });
    }
    (kinder || []).forEach(function (c) {
      if (c === null || c === undefined || c === false) return;
      el.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return el;
  }
  function fnv(str) {
    var x = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      x ^= str.charCodeAt(i);
      x = Math.imul(x, 0x01000193) >>> 0;
    }
    return x.toString(16);
  }
  function datumText(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    var tage = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
    function zz(n) { return (n < 10 ? "0" : "") + n; }
    return tage[d.getDay()] + ", " + zz(d.getDate()) + "." + zz(d.getMonth() + 1) + "." + d.getFullYear() +
      ", " + zz(d.getHours()) + ":" + zz(d.getMinutes()) + " Uhr";
  }
  function sterne(n) { return "★★★".slice(0, n) + "☆☆☆".slice(0, 3 - n); }
  function kopie(o) { return JSON.parse(JSON.stringify(o)); }

  // Zahlen aus Schülereingaben lesen: 3,5 · 3.5 · -2 · −2 · 7/2 · 1 1/2 · 2·10^3 ist nicht nötig
  function zahl(text) {
    if (text === null || text === undefined) return NaN;
    var s = String(text).trim().replace(/−/g, "-").replace(/\s+/g, " ");
    s = s.replace(/^\+/, "");
    if (s === "") return NaN;
    var m = s.match(/^(-?)(\d+) (\d+)\/(\d+)$/);
    if (m) return (m[1] ? -1 : 1) * (parseInt(m[2], 10) + parseInt(m[3], 10) / parseInt(m[4], 10));
    m = s.match(/^(-?\d+(?:[.,]\d+)?)\s*\/\s*(-?\d+(?:[.,]\d+)?)$/);
    if (m) return parseFloat(m[1].replace(",", ".")) / parseFloat(m[2].replace(",", "."));
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "");   // 1.000.000 oder 1.234,5
    s = s.replace(/ /g, "");
    if (!/^-?(\d+([.,]\d*)?|[.,]\d+)$/.test(s)) return NaN;
    return parseFloat(s.replace(",", "."));
  }
  function gleich(a, b, tol) {
    if (isNaN(a)) return false;
    // ganze Zahlen exakt prüfen (sonst würde bei großen Zahlen wie 13983816 auch ±10 durchgehen)
    var t = tol !== undefined ? tol : (Number.isInteger(b) ? 1e-9 * Math.max(1, Math.abs(b)) : 1e-6 * Math.max(1, Math.abs(b)));
    return Math.abs(a - b) <= t;
  }
  function normText(s) {
    return String(s || "").toLowerCase().trim().replace(/\s+/g, " ").replace(/[.!]$/, "");
  }
  function zahlAnzeige(v) {
    if (typeof v === "number") {
      var r = Math.round(v * 1e6) / 1e6;
      return String(r).replace(".", ",");
    }
    return String(v);
  }

  // ------------------------------------------------------------ Speicher
  var zustand = { auth: false, stufe: null, aufgaben: {}, hinweisWeg: false, gutschrift: {}, gesehen: {},
                  ohneHilfe: {}, abzeichen: {}, thema: {}, auftrag: null };
  function laden() {
    try {
      var raw = window.localStorage.getItem(SPEICHER_KEY);
      if (raw) {
        var z = JSON.parse(raw);
        if (z && typeof z === "object") zustand = Object.assign(zustand, z);
      }
      if (!zustand.gutschrift) zustand.gutschrift = {};
      if (!zustand.gesehen) zustand.gesehen = {};
      if (!zustand.ohneHilfe) zustand.ohneHilfe = {};
      if (!zustand.abzeichen) zustand.abzeichen = {};
      if (!zustand.thema) zustand.thema = {};
      if (!zustand.ohneHilfeMigriert) {
        // Ältere Spielstände: richtig gelöste Aufgaben, bei denen keine Hilfe geöffnet wurde
        Object.keys(zustand.gutschrift).forEach(function (id) {
          var s = zustand.aufgaben[id];
          if (s && (s.hilfen || 0) === 0) zustand.ohneHilfe[id] = 1;
        });
        zustand.ohneHilfeMigriert = true;
      }
      if (!zustand.gutschriftMigriert) {
        // Ältere Spielstände: richtig gelöste Aufgaben (ohne verratene Lösung) nachträglich gutschreiben
        Object.keys(zustand.aufgaben).forEach(function (id) {
          var s = zustand.aufgaben[id];
          if (s && s.status === "erledigt" && s.ergebnis && s.ergebnis.gesamt > 0 && s.ergebnis.richtig === s.ergebnis.gesamt && (s.hilfen || 0) < 3) zustand.gutschrift[id] = 1;
          if (s && (s.status === "erledigt" || (s.hilfen || 0) >= 3)) zustand.gesehen[id] = 1;
        });
        zustand.gutschriftMigriert = true;
      }
    } catch (e) { /* Speicher nicht verfügbar: Seite funktioniert trotzdem, nur ohne Erinnerung */ }
  }
  function sichern() {
    try { window.localStorage.setItem(SPEICHER_KEY, JSON.stringify(zustand)); return true; }
    catch (e) { return false; }
  }
  function stand(id) { return zustand.aufgaben[id] || null; }
  function status(id) { var s = stand(id); return s ? s.status : "offen"; }

  // ------------------------------------------------------------ Daten-Index
  var aufgabeNachId = {};
  D.aufgaben.forEach(function (a) { aufgabeNachId[a.id] = a; });
  var katNachId = {};
  D.kategorien.forEach(function (k) { katNachId[k.id] = k; });
  var stufeNachId = {};
  D.stufen.forEach(function (s) { stufeNachId[s.id] = s; });

  function aufgabenVon(stufe, kat, thema) {
    return D.aufgaben.filter(function (a) { return a.stufe === stufe && (!kat || a.kat === kat) && hatThema(a, thema); });
  }

  // ------------------------------------------------------------ Themen (Unterrichtsvorhaben)
  var TH = window.DENKWERK_THEMEN || { themen: {}, zuordnung: {} };
  function hatThema(a, thema) { return !thema || (TH.zuordnung[a.id] || []).indexOf(thema) >= 0; }
  function themenVon(stufe) {
    return (TH.themen[stufe] || []).map(function (t) {
      return { id: t[0], name: t[1], anzahl: aufgabenVon(stufe, null, t[0]).length };
    }).filter(function (t) { return t.anzahl > 0; });
  }
  function themaName(stufe, id) {
    var t = (TH.themen[stufe] || []).filter(function (x) { return x[0] === id; })[0];
    return t ? t[1] : "";
  }
  function themaAktiv(stufe) {
    var t = zustand.thema && zustand.thema[stufe];
    return t && themaName(stufe, t) ? t : "";
  }
  function themenDerAufgabe(a) {
    return (TH.zuordnung[a.id] || []).filter(function (t) { return t !== "kn"; }).map(function (t) { return themaName(a.stufe, t); });
  }
  function kategorienVon(stufe) {
    return D.kategorien.filter(function (k) { return aufgabenVon(stufe, k.id).length > 0; });
  }

  // ------------------------------------------------------------ Rahmen
  var app = document.getElementById("app");
  var aktuelleAnsicht = null;

  function toast(text) {
    var alt = $(".toast"); if (alt) alt.remove();
    var t = h("div", { class: "toast", role: "status", text: text });
    document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2600);
  }

  function logo() {
    return h("span", { class: "marke", html:
      '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="2" y="2" width="28" height="28" rx="7" fill="currentColor"/>' +
      '<polygon points="16,7 24.5,11.5 16,16 7.5,11.5" fill="var(--flaeche)"/>' +
      '<polygon points="7.5,12.8 15.3,17.2 15.3,25.8 7.5,21.4" fill="var(--flaeche)" fill-opacity=".7"/>' +
      '<polygon points="24.5,12.8 16.7,17.2 16.7,25.8 24.5,21.4" fill="var(--flaeche)" fill-opacity=".45"/></svg>' +
      '<span>Denkwerk</span>' });
  }

  function kopf(zurueck, stufe, ohneKlick) {
    var k = h("header", { class: "kopf" }, [logo()]);
    var gruppe = h("div", { class: "kopf-knoepfe" });
    if (zurueck) gruppe.appendChild(h("button", { class: "zurueck", type: "button", onclick: zurueck.aktion }, ["← " + zurueck.text]));
    var st = stufe === undefined ? zustand.stufe : stufe;
    if (st && stufeNachId[st]) {
      k.badge = rangAbzeichen(st, ohneKlick);
      k.appendChild(k.badge);
    }
    k.appendChild(gruppe);
    k.gruppe = gruppe;
    return k;
  }
  // Immer sichtbar: Rang und Medaillen des aktuellen Jahrgangs
  function rangAbzeichen(stufe, ohneKlick) {
    var r = rangInfo(stufe), m = medaillenZahl(stufe), s = stufeNachId[stufe];
    var inhalt = [
      h("span", { class: "rang-nr", "aria-hidden": "true", text: r.nr ? String(r.nr) : "–" }),
      h("span", { class: "rb-text" }, [
        h("span", { class: "rb-stufe", text: s.name }),
        h("span", { class: "rb-name", text: r.name || "Noch kein Rang" }),
      ]),
      h("span", { class: "rb-medaillen", "aria-label": m.silber + " Silber, " + m.gold + " Gold" }, [
        h("span", { class: "rb-m silber", title: "Kategorien mit Silber", text: String(m.silber) }),
        h("span", { class: "rb-m gold", title: "Kategorien mit Gold", text: String(m.gold) }),
      ]),
    ];
    var klasse = "rangabzeichen sf" + D.stufen.indexOf(s);
    if (ohneKlick) return h("span", { class: klasse + " still" }, inhalt);
    return h("button", { class: klasse, type: "button", "aria-label": "Meine Erfolge in " + s.name + ": " + (r.name ? "Rang " + r.nr + " " + r.name : "noch kein Rang") + ", " + m.silber + " Silber, " + m.gold + " Gold",
      onclick: function () { zeige("erfolge", stufe); } }, inhalt);
  }

  function zeige(ansicht, arg) {
    if (ansicht !== "druck") document.body.classList.remove("druckmodus");
    aktuelleAnsicht = { name: ansicht, arg: arg };
    app.innerHTML = "";
    var seite = h("main", { class: "seite" });
    app.appendChild(seite);
    ANSICHTEN[ansicht](seite, arg);
    if (["start", "stufe", "kategorie", "rad", "letzte", "erfolge"].indexOf(ansicht) >= 0) auftragBanner(seite);
    window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------ Dialog (statt confirm())
  function dialog(titel, text, knoepfe) {
    var schleier = h("div", { class: "schleier", role: "presentation" });
    var box = h("div", { class: "dialog", role: "dialog", "aria-modal": "true", "aria-labelledby": "dlg-titel" }, [
      h("h2", { id: "dlg-titel", text: titel }),
      text ? h("p", { html: text }) : null,
    ]);
    var reihe = h("div", { class: "knopfreihe" });
    function schliessen() { schleier.remove(); document.removeEventListener("keydown", esc); }
    function esc(e) { if (e.key === "Escape") schliessen(); }
    knoepfe.forEach(function (k) {
      reihe.appendChild(h("button", { class: "knopf " + (k.art || ""), type: "button", onclick: function () {
        schliessen(); if (k.aktion) k.aktion();
      } }, [k.text]));
    });
    box.appendChild(reihe);
    schleier.appendChild(box);
    schleier.addEventListener("click", function (e) { if (e.target === schleier) schliessen(); });
    document.addEventListener("keydown", esc);
    document.body.appendChild(schleier);
    var erster = reihe.querySelector("button"); if (erster) erster.focus();
  }

  // ------------------------------------------------------------ Ansichten
  var ANSICHTEN = {};

  ANSICHTEN.anmeldung = function (seite) {
    var fehler = h("p", { class: "fehler", role: "alert", hidden: true });
    var eingabe = h("input", { class: "feld", id: "passwort", type: "password", autocomplete: "current-password",
      "aria-label": "Passwort", placeholder: "Passwort" });
    var form = h("form", { novalidate: true }, [
      h("label", { for: "passwort", class: "label", text: "Passwort von deiner Lehrkraft" }),
      eingabe, fehler,
      h("button", { class: "knopf", type: "submit" }, ["Los geht's"]),
    ]);
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (fnv(eingabe.value.trim()) === PASSWORT_HASH) {
        zustand.auth = true; sichern();
        zeige("start");
      } else {
        fehler.hidden = false;
        fehler.textContent = "Das Passwort stimmt nicht. Achte auf Groß- und Kleinschreibung und den Bindestrich.";
        eingabe.select();
      }
    });
    seite.appendChild(h("div", { class: "anmeldung" }, [
      h("div", { class: "blatt stapel" }, [
        logo(),
        h("h1", { text: "Fertig? Dann knobel weiter." }),
        h("p", { class: "leise", text: "Zusatzaufgaben für alle, die im Matheunterricht schnell fertig sind." }),
        form,
      ]),
      h("footer", { class: "fuss", style: "margin-top:18px" }, [
        auftragAktiv() ? h("p", { text: "Ein Auftrag deiner Lehrkraft wartet schon auf dich: " + auftragBeschreibung(auftragAktiv()) + "." }) : null,
        h("button", { type: "button", onclick: function () { zeige("lehrkraft"); } }, ["Für Lehrkräfte"]),
      ]),
    ]));
    setTimeout(function () { eingabe.focus(); }, 50);
  };

  function fortschritt(stufe) {
    var alle = aufgabenVon(stufe);
    var fertig = alle.filter(function (a) { return status(a.id) === "erledigt"; }).length;
    return { fertig: fertig, alle: alle.length };
  }

  // ------------------------------------------------------------ Ränge und Medaillen
  // Gezählt werden nur richtig gelöste Aufgaben: geprüft, alles richtig, Lösung nicht vorher verraten.
  var RAENGE = ["Zahlenfinder", "Rechenlehrling", "Musterentdecker", "Knobelfuchs", "Rätselknacker",
                "Logikprofi", "Beweisführer", "Denkmeister", "Mathe-Ass", "Mathe-Genie"];
  // Eine Aufgabe zählt, wenn sie beim ersten Prüfen ganz richtig war und die Lösung vorher nicht angezeigt wurde.
  // Die Gutschrift bleibt auch nach „Aufgabe neu starten“ erhalten.
  function geloest(id) { return !!zustand.gutschrift[id]; }
  function anzahlGeloest(liste) { return liste.filter(function (a) { return geloest(a.id); }).length; }
  function rangInfo(stufe) {
    var alle = aufgabenVon(stufe), n = alle.length, g = anzahlGeloest(alle);
    var stufeNr = 0;
    for (var k = 1; k <= 10; k++) if (g >= Math.ceil(n * k / 10)) stufeNr = k;
    var naechste = stufeNr < 10 ? Math.ceil(n * (stufeNr + 1) / 10) - g : 0;
    return { nr: stufeNr, name: stufeNr ? RAENGE[stufeNr - 1] : null, geloest: g, alle: n, fehlen: naechste,
             naechsterName: stufeNr < 10 ? RAENGE[stufeNr] : null };
  }
  function medaillenZahl(stufe) {
    var m = { silber: 0, gold: 0 };
    kategorienVon(stufe).forEach(function (k) { var a = medaille(stufe, k.id).art; if (a) m[a]++; });
    return m;
  }
  function medaille(stufe, kat) {
    var auf = aufgabenVon(stufe, kat), g = anzahlGeloest(auf);
    return { geloest: g, alle: auf.length, art: (g === auf.length && g > 0) ? "gold" : (g * 2 >= auf.length && g > 0 ? "silber" : "") };
  }

  ANSICHTEN.start = function (seite) {
    seite.appendChild(kopf(null));
    var begonnen = Object.keys(zustand.aufgaben).filter(function (id) { return aufgabeNachId[id]; }).length;
    seite.appendChild(h("section", { class: "begruessung" }, [
      h("h1", { text: "Welche Stufe bist du?" }),
      h("p", { text: "Wähle deine Jahrgangsstufe. Dort findest du Knobelaufgaben, die zu dem passen, was du schon kannst. Du darfst auch eine Stufe höher probieren." }),
    ]));
    var raster = h("div", { class: "stufen" });
    D.stufen.forEach(function (s, i) {
      var r = rangInfo(s.id);
      raster.appendChild(h("button", { class: "stufe sf" + i, type: "button", "aria-label": s.name + ", " + (r.name ? "Rang " + r.nr + ": " + r.name : "noch kein Rang"), onclick: function () {
        zustand.stufe = s.id; sichern(); zeige("stufe", s.id);
      } }, [
        h("span", { class: "gross", text: s.kurz }),
        h("span", { class: "klein", text: s.name }),
        h("span", { class: "rang" + (r.nr ? "" : " leer") }, [
          h("span", { class: "rang-nr", "aria-hidden": "true", text: r.nr ? String(r.nr) : "–" }),
          h("span", { class: "rang-name", text: r.name || "Noch kein Rang" }),
        ]),
        h("span", { class: "klein stand", text: r.geloest + " von " + r.alle + " gelöst" }),
        h("span", { class: "balken rangbalken", "aria-hidden": "true" }, [h("span", { style: "width:" + (r.alle ? (100 * r.geloest / r.alle) : 0) + "%" })]),
      ]));
    });
    seite.appendChild(raster);
    seite.appendChild(h("div", { class: "knopfreihe abstand" }, [
      h("button", { class: "knopf leicht", type: "button", onclick: function () { zeige("erfolge", zustand.stufe || D.stufen[0].id); } }, ["Meine Erfolge & Urkunde"]),
      h("button", { class: "knopf zweit", type: "button", onclick: auftragscodeDialog }, ["Auftragscode eingeben"]),
    ]));

    var letzte = h("section", { class: "abschnitt" }, [
      h("div", { class: "zeile-zwischen" }, [
        h("h2", { text: "Letzte Aufgaben" }),
        h("button", { class: "knopf" + (begonnen ? "" : " zweit"), type: "button", onclick: function () { zeige("letzte"); } },
          [begonnen ? "Liste öffnen (" + begonnen + ")" : "Liste öffnen"]),
      ]),
    ]);
    var neueste = zuletztListe().slice(0, 3);
    if (neueste.length) {
      var l = h("div", { class: "liste" });
      neueste.forEach(function (a) { l.appendChild(aufgabeEintrag(a, true)); });
      letzte.appendChild(l);
    } else {
      letzte.appendChild(h("p", { class: "leise", text: "Hier erscheinen Aufgaben, sobald du eine gespeichert oder geprüft hast." }));
    }
    seite.appendChild(letzte);

    if (!zustand.hinweisWeg) {
      var hw = h("div", { class: "hinweis abschnitt" }, [
        h("p", { html: "<strong>Tipp fürs iPad:</strong> Tippe in Safari auf <em>Teilen</em> → <em>Zum Home-Bildschirm</em>. Dann öffnet sich Denkwerk wie eine App und dein Fortschritt bleibt sicher gespeichert." }),
        h("button", { type: "button", onclick: function () { zustand.hinweisWeg = true; sichern(); hw.remove(); } }, ["Ok"]),
      ]);
      seite.appendChild(hw);
    }

    seite.appendChild(sicherungBereich());
    seite.appendChild(h("footer", { class: "fuss" }, [
      h("p", { text: "Dein Fortschritt wird nur auf diesem Gerät gespeichert. Niemand sonst kann ihn sehen." }),
      h("button", { type: "button", onclick: function () {
        dialog("Alles zurücksetzen?", "Damit löschst du alle gespeicherten Aufgaben und Ergebnisse auf diesem Gerät. Das lässt sich nicht rückgängig machen.", [
          { text: "Ja, alles löschen", art: "warn", aktion: function () {
            zustand.aufgaben = {}; zustand.gutschrift = {}; zustand.gesehen = {}; zustand.ohneHilfe = {}; zustand.abzeichen = {};
            sichern(); toast("Fortschritt gelöscht"); zeige("start");
          } },
          { text: "Abbrechen", art: "zweit" },
        ]);
      } }, ["Fortschritt auf diesem Gerät löschen"]),
      h("button", { type: "button", onclick: function () { zeige("lehrkraft"); } }, ["Für Lehrkräfte"]),
    ]));
  };

  ANSICHTEN.stufe = function (seite, stufe) {
    var s = stufeNachId[stufe];
    var thema = themaAktiv(stufe);
    seite.appendChild(kopf({ text: "Hauptmenü", aktion: function () { zeige("start"); } }, stufe));
    var f = fortschritt(stufe);
    var r = rangInfo(stufe);
    seite.appendChild(h("section", { class: "begruessung" }, [
      h("span", { class: "label", text: s.name }),
      h("h1", { text: "Such dir eine Kategorie aus" }),
      h("p", { text: r.geloest + " von " + r.alle + " Aufgaben richtig gelöst (" + f.fertig + " bearbeitet). Die Zahlen rechts zeigen, wie viele Aufgaben einer Kategorie du richtig gelöst hast. Oder lass das Glücksrad entscheiden." }),
    ]));
    seite.appendChild(h("div", { class: "rangkarte sf" + D.stufen.indexOf(s) }, [
      h("span", { class: "rang-nr gross-nr", "aria-hidden": "true", text: r.nr ? String(r.nr) : "–" }),
      h("div", { class: "stapel-eng" }, [
        h("span", { class: "label", text: "Dein Rang in " + s.name }),
        h("strong", { class: "rang-titel", text: r.name ? r.name + " (Rang " + r.nr + " von 10)" : "Noch kein Rang" }),
        h("span", { class: "leise", text: r.nr === 10 ? "Höchster Rang erreicht – alle Aufgaben dieser Stufe gelöst!" :
          "Noch " + r.fehlen + " richtig gelöste " + (r.fehlen === 1 ? "Aufgabe" : "Aufgaben") + " bis „" + r.naechsterName + "“." }),
      ]),
    ]));
    var themen = themenVon(stufe);
    if (themen.length) {
      var tf = h("div", { class: "filter themenfilter", role: "group", "aria-label": "Thema aus dem Unterricht" });
      [{ id: "", name: "Alle Themen", anzahl: aufgabenVon(stufe).length }].concat(themen).forEach(function (t) {
        tf.appendChild(h("button", { type: "button", "aria-pressed": String(thema === t.id), onclick: function () {
          zustand.thema[stufe] = t.id; sichern(); zeige("stufe", stufe);
        } }, [t.name + " ", h("span", { class: "anz", text: String(t.anzahl) })]));
      });
      seite.appendChild(h("section", { class: "themenwahl" }, [
        h("h2", { class: "h-klein", text: "Thema aus dem Unterricht" }),
        h("p", { class: "leise", text: thema ? "Du siehst nur Aufgaben zum Thema „" + themaName(stufe, thema) + "“. Auch das Glücksrad lost nur daraus." :
          "Wähle ein Thema, dann siehst du nur Aufgaben, die dazu passen. „Knobeln allgemein“ sind Rätsel ohne festes Unterrichtsthema." }),
        tf,
      ]));
    }
    seite.appendChild(h("div", { class: "knopfreihe abstand" }, [
      h("button", { class: "knopf", type: "button", onclick: function () { zeige("rad", stufe); } }, ["Glücksrad drehen"]),
      h("button", { class: "knopf zweit", type: "button", onclick: function () { zeige("letzte"); } }, ["Letzte Aufgaben"]),
    ]));
    var auftrag = auftragAktiv();
    var liste = h("div", { class: "liste abschnitt" });
    kategorienVon(stufe).forEach(function (k) {
      var auf = aufgabenVon(stufe, k.id, thema);
      if (!auf.length) return;
      var imAuftrag = auftrag && auftrag.s === stufe && (!auftrag.k || !auftrag.k.length || auftrag.k.indexOf(k.id) >= 0) && (!auftrag.t || auftrag.t === thema);
      var fertig = auf.filter(function (a) { return status(a.id) === "erledigt"; }).length;
      var angefangen = auf.filter(function (a) { return status(a.id) === "begonnen"; }).length;
      var md = medaille(stufe, k.id);
      var g = thema ? anzahlGeloest(auf) : md.geloest;
      var klasse = "eintrag" + (fertig === auf.length ? " erledigt" : (angefangen ? " begonnen" : "")) + (md.art ? " " + md.art : "");
      liste.appendChild(h("button", { class: klasse, type: "button", onclick: function () { zeige("kategorie", { stufe: stufe, kat: k.id }); } }, [
        h("span", { class: "sym", "aria-hidden": "true", text: k.symbol }),
        h("span", { class: "mitte" }, [
          h("span", { class: "titel" }, [k.name, imAuftrag ? h("span", { class: "chip auftrag", text: "Auftrag" }) : null]),
          h("span", { class: "unter", text: (thema ? auf.length + (auf.length === 1 ? " Aufgabe" : " Aufgaben") + " zum Thema" : k.kurz) + (md.art === "gold" ? " · Gold: alles gelöst" : (md.art === "silber" ? " · Silber: Hälfte gelöst" : "")) }),
        ]),
        h("span", { class: "stand", title: g + " von " + auf.length + " richtig gelöst (" + fertig + " bearbeitet)", "aria-label": g + " von " + auf.length + " richtig gelöst", text: g + "/" + auf.length }),
      ]));
    });
    seite.appendChild(liste);
  };

  function aufgabeEintrag(a, mitHerkunft) {
    var st = status(a.id);
    var sd = stand(a.id);
    var unter = [];
    if (mitHerkunft) unter.push(stufeNachId[a.stufe].name + " · " + katNachId[a.kat].name);
    if (sd && sd.zuletzt) unter.push("zuletzt bearbeitet: " + datumText(sd.zuletzt));
    if (!unter.length) unter.push(sterne(a.sterne) + "  " + ["", "leicht", "mittel", "knifflig"][a.sterne]);
    var chipText = st === "erledigt" ? (sd && sd.ergebnis ? sd.ergebnis.kurz : "erledigt") : (st === "begonnen" ? "begonnen" : "offen");
    return h("button", { class: "eintrag " + (st === "offen" ? "" : st), type: "button", onclick: function () { zeige("aufgabe", a.id); } }, [
      h("span", { class: "sym", "aria-hidden": "true", text: katNachId[a.kat].symbol }),
      h("span", { class: "mitte" }, [
        h("span", { class: "titel", text: a.titel }),
        h("span", { class: "unter", text: unter.join(" · ") }),
      ]),
      h("span", { class: "chip " + st, text: chipText }),
    ]);
  }

  ANSICHTEN.kategorie = function (seite, arg) {
    var k = katNachId[arg.kat];
    var thema = themaAktiv(arg.stufe);
    var auf = aufgabenVon(arg.stufe, arg.kat, thema);
    seite.appendChild(kopf({ text: "Kategorien", aktion: function () { zeige("stufe", arg.stufe); } }, arg.stufe));
    seite.appendChild(h("section", { class: "begruessung" }, [
      h("span", { class: "label", text: stufeNachId[arg.stufe].name }),
      h("h1", { text: k.name }),
      h("p", { text: k.beschreibung }),
    ]));
    if (thema) {
      var leerThema = !auf.length;
      if (leerThema) auf = aufgabenVon(arg.stufe, arg.kat);
      seite.appendChild(h("div", { class: "hinweis", style: "margin-bottom:14px" }, [
        h("p", { text: leerThema ? "Zum Thema „" + themaName(arg.stufe, thema) + "“ gibt es hier keine Aufgabe. Du siehst alle Aufgaben der Kategorie." :
          "Gefiltert: nur Aufgaben zum Thema „" + themaName(arg.stufe, thema) + "“." }),
        leerThema ? null : h("button", { type: "button", onclick: function () { zustand.thema[arg.stufe] = ""; sichern(); zeige("kategorie", arg); } }, ["Alle zeigen"]),
      ]));
    }
    var liste = h("div", { class: "liste" });
    auf.forEach(function (a) { liste.appendChild(aufgabeEintrag(a, false)); });
    seite.appendChild(liste);
  };

  function zuletztListe() {
    return Object.keys(zustand.aufgaben)
      .filter(function (id) { return aufgabeNachId[id]; })
      .sort(function (x, y) { return (zustand.aufgaben[y].zuletzt || "").localeCompare(zustand.aufgaben[x].zuletzt || ""); })
      .map(function (id) { return aufgabeNachId[id]; });
  }

  ANSICHTEN.letzte = function (seite, filter) {
    filter = filter || "alle";
    seite.appendChild(kopf({ text: "Hauptmenü", aktion: function () { zeige("start"); } }));
    seite.appendChild(h("section", { class: "begruessung" }, [
      h("h1", { text: "Letzte Aufgaben" }),
      h("p", { text: "Die zuletzt bearbeitete Aufgabe steht oben. Begonnene Aufgaben sind gelb markiert, erledigte grün." }),
    ]));
    var fl = h("div", { class: "filter", role: "group", "aria-label": "Filter" });
    [["alle", "Alle"], ["begonnen", "Begonnen"], ["erledigt", "Erledigt"]].forEach(function (f) {
      fl.appendChild(h("button", { type: "button", "aria-pressed": String(filter === f[0]), onclick: function () { zeige("letzte", f[0]); } }, [f[1]]));
    });
    seite.appendChild(fl);
    var liste = h("div", { class: "liste abschnitt" });
    var eintraege = zuletztListe().filter(function (a) { return filter === "alle" || status(a.id) === filter; });
    if (!eintraege.length) liste.appendChild(h("p", { class: "leise", text: filter === "begonnen" ? "Du hast gerade keine angefangene Aufgabe." : "Noch nichts da. Starte eine Aufgabe und speichere sie oder prüfe sie." }));
    eintraege.forEach(function (a) { liste.appendChild(aufgabeEintrag(a, true)); });
    seite.appendChild(liste);
  };

  // ------------------------------------------------------------ Glücksrad
  var FARBEN_HELL = ["#c9d4f6", "#ffe39a", "#bfe5c9", "#f8c9c2", "#d9cdf3", "#bfe3ea", "#f6d5b0", "#e0e6a8"];
  ANSICHTEN.rad = function (seite, stufe) {
    var thema = themaAktiv(stufe);
    seite.appendChild(kopf({ text: "Kategorien", aktion: function () { zeige("stufe", stufe); } }, stufe));
    seite.appendChild(h("section", { class: "begruessung" }, [
      h("span", { class: "label", text: stufeNachId[stufe].name + (thema ? " · Thema: " + themaName(stufe, thema) : "") }),
      h("h1", { text: "Glücksrad" }),
      h("p", { text: thema ? "Das Rad lost dir eine Aufgabe zum Thema „" + themaName(stufe, thema) + "“ zu. Erledigte Aufgaben sind nicht mehr dabei." :
        "Das Rad lost dir eine Aufgabe aus allen Kategorien zu. Erledigte Aufgaben sind nicht mehr dabei." }),
    ]));
    var offen = aufgabenVon(stufe, null, thema).filter(function (a) { return status(a.id) !== "erledigt"; });
    if (!offen.length) {
      seite.appendChild(h("div", { class: "blatt stapel" }, [
        h("h2", { text: "Alles geschafft!" }),
        h("p", { text: thema ? "Du hast alle Aufgaben zu diesem Thema erledigt. Wähle ein anderes Thema oder „Alle Themen“." : "Du hast alle Aufgaben dieser Stufe erledigt. Probier doch die nächste Stufe aus." }),
      ]));
      return;
    }
    var kats = [];
    offen.forEach(function (a) { if (kats.indexOf(a.kat) < 0) kats.push(a.kat); });
    kats.sort(function (x, y) { return D.kategorien.indexOf(katNachId[x]) - D.kategorien.indexOf(katNachId[y]); });

    var canvas = h("canvas", { width: "880", height: "880", "aria-label": "Glücksrad mit " + kats.length + " Kategorien", role: "img" });
    var rahmen = h("div", { class: "rad-rahmen" }, [canvas, h("div", { class: "rad-zeiger", "aria-hidden": "true" })]);
    var knopf = h("button", { class: "knopf", type: "button" }, ["Drehen"]);
    var ergebnis = h("div", { class: "rad-ergebnis", "aria-live": "polite" });
    seite.appendChild(h("div", { class: "rad-buehne" }, [rahmen, knopf, ergebnis]));

    var ctx = canvas.getContext("2d");
    var winkel = 0;
    var seg = (Math.PI * 2) / kats.length;
    function farbeText() { return getComputedStyle(document.documentElement).getPropertyValue("--text").trim() || "#1c2233"; }
    function zeichne() {
      var w = canvas.width, r = w / 2 - 8;
      ctx.clearRect(0, 0, w, w);
      ctx.save(); ctx.translate(w / 2, w / 2); ctx.rotate(winkel);
      for (var i = 0; i < kats.length; i++) {
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.arc(0, 0, r, i * seg - Math.PI / 2, (i + 1) * seg - Math.PI / 2);
        ctx.closePath();
        ctx.fillStyle = FARBEN_HELL[i % FARBEN_HELL.length]; ctx.fill();
        ctx.strokeStyle = "#1c2233"; ctx.lineWidth = 2; ctx.stroke();
        ctx.save();
        ctx.rotate(i * seg + seg / 2 - Math.PI / 2);
        ctx.fillStyle = "#1c2233";
        ctx.textAlign = "right"; ctx.textBaseline = "middle";
        var name = katNachId[kats[i]].radname || katNachId[kats[i]].name;
        var groesse = kats.length > 16 ? 22 : (kats.length > 10 ? 26 : 32);
        ctx.font = "700 " + groesse + "px " + "Atkinson Hyperlegible, Arial, sans-serif";
        ctx.fillText(name, r - 22, 0);
        ctx.restore();
      }
      ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.fillStyle = "#1f3d9e"; ctx.fill();
      ctx.restore();
      ctx.beginPath(); ctx.arc(w / 2, w / 2, r, 0, Math.PI * 2); ctx.strokeStyle = farbeText(); ctx.lineWidth = 6; ctx.stroke();
    }
    zeichne();

    var dreht = false;
    knopf.addEventListener("click", function () {
      if (dreht) return;
      dreht = true; knopf.disabled = true; ergebnis.innerHTML = "";
      var gewaehlt = offen[Math.floor(Math.random() * offen.length)];
      var idx = kats.indexOf(gewaehlt.kat);
      // Segment idx soll oben unter dem Zeiger landen: Segmentmitte bei -PI/2 + (idx+0.5)*seg + winkel = -PI/2
      var ziel = -(idx + 0.5) * seg + (Math.random() - 0.5) * seg * 0.6;
      var start = winkel;
      var basis = start - (start % (Math.PI * 2));
      var ende = basis + Math.PI * 2 * 5 + ((ziel % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      if (ende - start < Math.PI * 8) ende += Math.PI * 2;
      var reduziert = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      var dauer = reduziert ? 300 : 3600;
      var t0 = null;
      function schritt(t) {
        if (t0 === null) t0 = t;
        var p = Math.min(1, (t - t0) / dauer);
        var e = 1 - Math.pow(1 - p, 4);
        winkel = start + (ende - start) * e;
        zeichne();
        if (p < 1) requestAnimationFrame(schritt);
        else {
          dreht = false; knopf.disabled = false; knopf.textContent = "Nochmal drehen";
          var k = katNachId[gewaehlt.kat];
          ergebnis.appendChild(h("div", { class: "blatt stapel" }, [
            h("span", { class: "label", text: "Dein Los" }),
            h("h2", { text: k.name + ": " + gewaehlt.titel }),
            h("p", { class: "leise", text: sterne(gewaehlt.sterne) + "  " + ["", "leicht", "mittel", "knifflig"][gewaehlt.sterne] + (status(gewaehlt.id) === "begonnen" ? " · schon begonnen" : "") }),
            h("div", { class: "knopfreihe" }, [
              h("button", { class: "knopf", type: "button", onclick: function () { zeige("aufgabe", gewaehlt.id); } }, ["Aufgabe starten"]),
            ]),
          ]));
        }
      }
      requestAnimationFrame(schritt);
    });
  };

  // ------------------------------------------------------------ Aufgabe
  // ---------- Schmierzettel ----------
  // Pro Aufgabe ein Zeichenblatt für Nebenrechnungen. Gespeichert werden nur die Striche
  // (Punkte in Tausendstel der Blattbreite) unter einem eigenen Schlüssel, damit der
  // Fortschritt klein bleibt. Es werden höchstens SCHMIER_MAX Blätter behalten.
  var SCHMIER_KEY = "denkwerk.schmier.v1", SCHMIER_MAX = 40;
  function schmierAlle() {
    try { return JSON.parse(localStorage.getItem(SCHMIER_KEY) || "{}") || {}; } catch (e) { return {}; }
  }
  function schmierSchreiben(alle) {
    var ids = Object.keys(alle).sort(function (x, y) { return (alle[y].t || 0) - (alle[x].t || 0); });
    while (ids.length > SCHMIER_MAX) delete alle[ids.pop()];
    for (var versuch = 0; versuch < 8; versuch++) {
      try { localStorage.setItem(SCHMIER_KEY, JSON.stringify(alle)); return true; }
      catch (e) { if (ids.length <= 1) return false; delete alle[ids.pop()]; }
    }
    return false;
  }
  function schmierLoeschen(id) { var alle = schmierAlle(); if (alle[id]) { delete alle[id]; schmierSchreiben(alle); } }

  function schmierzettel(id) {
    var gespeichert = schmierAlle()[id] || null;
    var striche = gespeichert && gespeichert.s ? gespeichert.s : [];
    var hoehe = gespeichert && gespeichert.h ? gespeichert.h : 1;   // Faktor für „mehr Platz“
    var raster = gespeichert ? gespeichert.r !== 0 : true;
    var werkzeugArt = "stift", farbe = 0, stiftGesehen = false;
    var FARBEN = ["--text", "--tinte", "--falsch"];

    var box = h("section", { class: "schmier", "aria-label": "Schmierzettel" });
    var offen = striche.length > 0;
    var umschalter = h("button", { class: "knopf leicht schmier-auf", type: "button", "aria-expanded": offen ? "true" : "false" });
    var inhalt = h("div", { class: "schmier-inhalt" });
    box.appendChild(umschalter); box.appendChild(inhalt);

    var leinwand = h("canvas", { class: "schmier-blatt", "aria-label": "Zeichenfläche für Nebenrechnungen. Mit Finger, Stift oder Maus schreiben." });
    var ctx = leinwand.getContext("2d");
    var knoepfe = {};
    function wk(name, text, titel, aktion) {
      var b = h("button", { class: "schmier-knopf", type: "button", title: titel, "aria-label": titel, onclick: aktion }, [text]);
      knoepfe[name] = b; return b;
    }
    var leiste = h("div", { class: "schmier-leiste", role: "toolbar", "aria-label": "Werkzeuge" }, [
      wk("stift0", "✎", "Stift schwarz", function () { werkzeugArt = "stift"; farbe = 0; markieren(); }),
      wk("stift1", "✎", "Stift blau", function () { werkzeugArt = "stift"; farbe = 1; markieren(); }),
      wk("stift2", "✎", "Stift rot", function () { werkzeugArt = "stift"; farbe = 2; markieren(); }),
      wk("radierer", "⌫", "Radierer", function () { werkzeugArt = "radierer"; markieren(); }),
      h("span", { class: "schmier-trenner" }),
      wk("zurueck", "↶", "Rückgängig", function () { if (striche.length) { striche.pop(); zeichnen(); merken(); } }),
      wk("raster", "#", "Kästchen ein/aus", function () { raster = !raster; rasterSetzen(); merken(); }),
      wk("mehr", "+", "Mehr Platz", function () { if (hoehe < 3) { hoehe += 0.5; groesse(); merken(); } }),
      wk("leeren", "🗑", "Alles löschen", function () {
        if (!striche.length) return;
        dialog("Schmierzettel leeren?", "Alles, was du auf den Schmierzettel geschrieben hast, wird gelöscht.", [
          { text: "Leeren", art: "warn", aktion: function () { striche = []; hoehe = 1; groesse(); merken(); } },
          { text: "Abbrechen", art: "zweit" },
        ]);
      }),
    ]);
    knoepfe.stift1.classList.add("blau"); knoepfe.stift2.classList.add("rot");
    inhalt.appendChild(leiste);
    inhalt.appendChild(h("div", { class: "schmier-rahmen" }, [leinwand]));
    inhalt.appendChild(h("p", { class: "leise schmier-hinweis", text: "Nur für dich: Der Schmierzettel wird nicht geprüft und bleibt auf diesem Gerät." }));

    function markieren() {
      ["stift0", "stift1", "stift2", "radierer"].forEach(function (n) { knoepfe[n].setAttribute("aria-pressed", "false"); });
      knoepfe[werkzeugArt === "radierer" ? "radierer" : "stift" + farbe].setAttribute("aria-pressed", "true");
      leinwand.classList.toggle("radiert", werkzeugArt === "radierer");
    }
    function rasterSetzen() { leinwand.classList.toggle("ohne-raster", !raster); knoepfe.raster.setAttribute("aria-pressed", raster ? "true" : "false"); }
    function farbWert(i) { return getComputedStyle(document.documentElement).getPropertyValue(FARBEN[i]).trim() || "#1c2233"; }

    var breite = 0, dpr = 1;
    function groesse() {
      var w = leinwand.parentNode.clientWidth || 600;
      breite = w;
      var hpx = Math.round(Math.max(260, Math.min(w * 0.62, 460)) * hoehe);
      dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      leinwand.style.height = hpx + "px";
      leinwand.width = Math.round(w * dpr); leinwand.height = Math.round(hpx * dpr);
      zeichnen();
    }
    function strichMalen(s) {
      var p = s.p, f = breite / 1000;
      if (!p || p.length < 2) return;
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      if (s.f === "r") { ctx.globalCompositeOperation = "destination-out"; ctx.lineWidth = 22; ctx.strokeStyle = "#000"; }
      else { ctx.globalCompositeOperation = "source-over"; ctx.lineWidth = 2.4; ctx.strokeStyle = farbWert(s.c || 0); }
      ctx.beginPath();
      ctx.moveTo(p[0] * f, p[1] * f);
      if (p.length === 2) ctx.lineTo(p[0] * f + 0.1, p[1] * f + 0.1);
      for (var i = 2; i < p.length; i += 2) ctx.lineTo(p[i] * f, p[i + 1] * f);
      ctx.stroke();
      ctx.restore();
    }
    function zeichnen() {
      ctx.clearRect(0, 0, leinwand.width, leinwand.height);
      striche.forEach(strichMalen);
    }
    var speicherUhr = null;
    function merken() {
      clearTimeout(speicherUhr);
      speicherUhr = setTimeout(function () {
        var alle = schmierAlle();
        if (!striche.length && hoehe === 1 && raster) delete alle[id];
        else alle[id] = { s: striche, h: hoehe, r: raster ? 1 : 0, t: Date.now() };
        if (!schmierSchreiben(alle)) toast("Der Schmierzettel konnte nicht gespeichert werden");
      }, 500);
    }

    var aktiv = null, zeigerId = null;
    function punkt(ev) {
      var r = leinwand.getBoundingClientRect();
      return [Math.round((ev.clientX - r.left) / breite * 1000), Math.round((ev.clientY - r.top) / breite * 1000)];
    }
    leinwand.addEventListener("pointerdown", function (ev) {
      if (ev.pointerType === "pen") stiftGesehen = true;
      if (ev.pointerType === "touch" && stiftGesehen) return;   // Handballen ignorieren, wenn ein Stift benutzt wird
      if (ev.button !== undefined && ev.button > 0 && ev.pointerType === "mouse") return;
      ev.preventDefault();
      zeigerId = ev.pointerId;
      try { leinwand.setPointerCapture(ev.pointerId); } catch (e) {}
      var q = punkt(ev);
      aktiv = werkzeugArt === "radierer" ? { f: "r", p: q } : { f: "p", c: farbe, p: q };
      striche.push(aktiv);
      zeichnen();
    });
    leinwand.addEventListener("pointermove", function (ev) {
      if (!aktiv || ev.pointerId !== zeigerId) return;
      ev.preventDefault();
      var liste = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [ev];
      if (!liste.length) liste = [ev];
      liste.forEach(function (e) {
        var q = punkt(e), p = aktiv.p, n = p.length;
        if (Math.abs(q[0] - p[n - 2]) + Math.abs(q[1] - p[n - 1]) >= 2) { p.push(q[0], q[1]); }
      });
      zeichnen();
    });
    function ende(ev) {
      if (!aktiv || (ev && ev.pointerId !== zeigerId)) return;
      aktiv = null; zeigerId = null;
      merken();
    }
    leinwand.addEventListener("pointerup", ende);
    leinwand.addEventListener("pointercancel", ende);

    function oeffnen(auf) {
      offen = auf;
      umschalter.setAttribute("aria-expanded", auf ? "true" : "false");
      umschalter.textContent = auf ? "✎ Schmierzettel ausblenden" : "✎ Schmierzettel für Nebenrechnungen";
      inhalt.hidden = !auf;
      if (auf) requestAnimationFrame(groesse);
    }
    umschalter.addEventListener("click", function () { oeffnen(!offen); });
    var groesseUhr = null;
    window.addEventListener("resize", function () {
      if (!offen || !document.body.contains(leinwand)) return;
      clearTimeout(groesseUhr); groesseUhr = setTimeout(groesse, 150);
    });
    // Farben neu zeichnen, wenn das Farbschema wechselt
    if (window.matchMedia) {
      var mq = window.matchMedia("(prefers-color-scheme: dark)");
      var neu = function () { if (offen && document.body.contains(leinwand)) zeichnen(); };
      if (mq.addEventListener) mq.addEventListener("change", neu); else if (mq.addListener) mq.addListener(neu);
    }
    markieren(); rasterSetzen(); oeffnen(offen);
    return box;
  }

  ANSICHTEN.aufgabe = function (seite, id) {
    var a = aufgabeNachId[id];
    var k = katNachId[a.kat];
    var gespeichert = stand(id);
    var arbeit = gespeichert ? kopie(gespeichert) : { status: "offen", antworten: {}, hilfen: 0 };
    if (!arbeit.antworten) arbeit.antworten = {};
    var erledigt = arbeit.status === "erledigt";
    var typ = TYPEN[a.typ];

    function verlassen(ziel) {
      if (erledigt) { ziel(); return; }
      dialog("Aufgabe verlassen?", "Möchtest du deinen Stand speichern? Dann findest du die Aufgabe unter <strong>Letzte Aufgaben</strong> wieder.", [
        { text: "Speichern und verlassen", aktion: function () { speichern(); ziel(); } },
        { text: "Ohne Speichern verlassen", art: "zweit", aktion: ziel },
        { text: "Weiterarbeiten", art: "leicht" },
      ]);
    }
    function speichern() {
      arbeit.antworten = typ.lesen(ui);
      arbeit.status = "begonnen";
      arbeit.zuletzt = new Date().toISOString();
      zustand.aufgaben[id] = kopie(arbeit);
      if (sichern()) toast("Gespeichert");
      else toast("Speichern hat nicht geklappt – der Browser erlaubt keinen Speicher");
    }

    var k1 = kopf({ text: "Hauptmenü", aktion: function () { verlassen(function () { zeige("start"); }); } }, a.stufe, true);
    k1.gruppe.insertBefore(h("button", { class: "zurueck", type: "button", onclick: function () {
      verlassen(function () { zeige("kategorie", { stufe: a.stufe, kat: a.kat }); });
    } }, ["← " + k.name]), k1.gruppe.firstChild);
    seite.appendChild(k1);

    var blatt = h("article", { class: "blatt stapel" });
    seite.appendChild(blatt);
    var meta = h("div", { class: "meta" }, [
      h("span", { class: "sterne", "aria-label": a.sterne + " von 3 Sternen", text: sterne(a.sterne) }),
      h("span", { text: stufeNachId[a.stufe].name + " · " + k.name }),
    ]);
    var thNamen = themenDerAufgabe(a);
    if (thNamen.length) meta.appendChild(h("span", { class: "chip thema", text: "Thema: " + thNamen.join(", ") }));
    if (gespeichert && gespeichert.zuletzt) meta.appendChild(h("span", { class: "chip " + gespeichert.status, text: "zuletzt: " + datumText(gespeichert.zuletzt) }));
    blatt.appendChild(h("header", { class: "aufgabe-kopf" }, [meta, h("h1", { text: a.titel }),
      h("p", { class: "leise", style: "font-size:.85rem", text: "Kompetenz: " + a.kompetenz })]));
    blatt.appendChild(h("div", { class: "aufgabentext", html: a.text }));
    blatt.appendChild(schmierzettel(id));

    var bereich = h("div", { class: "antworten" });
    blatt.appendChild(bereich);
    var ui = typ.bauen(a, bereich, arbeit.antworten);

    // Hilfe (gestaffelt) und Prüfen
    var werkzeug = h("div", { class: "werkzeug" });
    blatt.appendChild(werkzeug);
    var hilfeBereich = h("div", { class: "stapel" });
    var ergebnisBereich = h("div", { class: "stapel", "aria-live": "polite" });
    var hilfeKnopf = h("button", { class: "knopf leicht", type: "button" });
    var pruefKnopf = h("button", { class: "knopf", type: "button" }, ["Prüfen"]);
    var speicherKnopf = h("button", { class: "knopf zweit", type: "button", onclick: function () { speichern(); } }, ["Speichern"]);
    var resetKnopf = h("button", { class: "knopf zweit", type: "button", hidden: true }, ["Aufgabe neu starten"]);
    werkzeug.appendChild(hilfeBereich);
    werkzeug.appendChild(h("div", { class: "knopfreihe" }, [hilfeKnopf, pruefKnopf, speicherKnopf, resetKnopf]));
    werkzeug.appendChild(ergebnisBereich);

    function hilfenZeigen() {
      hilfeBereich.innerHTML = "";
      for (var i = 0; i < Math.min(arbeit.hilfen, 2); i++) {
        hilfeBereich.appendChild(h("div", { class: "hilfe-box" }, [
          h("span", { class: "label", text: "Hilfe " + (i + 1) }), h("div", { html: a.hilfen[i] }),
        ]));
      }
      if (arbeit.hilfen >= 3) {
        hilfeBereich.appendChild(h("div", { class: "hilfe-box loesung" }, [
          h("span", { class: "label", text: "Lösung" }),
          typ.loesungKurz ? h("div", { html: typ.loesungKurz(a) }) : null,
          h("div", { html: a.loesungsweg }),
        ]));
      }
      var texte = ["Hilfe 1 anzeigen", "Hilfe 2 anzeigen", "Lösung verraten"];
      if (arbeit.hilfen >= 3 || erledigt) hilfeKnopf.hidden = true;
      else { hilfeKnopf.hidden = false; hilfeKnopf.textContent = texte[arbeit.hilfen]; }
    }
    hilfeKnopf.addEventListener("click", function () {
      if (arbeit.hilfen === 2) {
        dialog("Lösung wirklich anzeigen?", "Probier es ruhig noch ein bisschen. Wenn du die Lösung siehst, ist die Aufgabe nicht mehr spannend.", [
          { text: "Ja, Lösung zeigen", aktion: function () { arbeit.hilfen = 3; zustand.gesehen[id] = 1; sichern(); hilfenZeigen(); } },
          { text: "Ich probiere weiter", art: "zweit" },
        ]);
        return;
      }
      arbeit.hilfen++; hilfenZeigen();
    });

    function auswertungZeigen(erg) {
      ergebnisBereich.innerHTML = "";
      var art = erg.selbst ? "teil" : (erg.richtig === erg.gesamt ? "ok" : (erg.richtig > 0 ? "teil" : "nein"));
      var ueberschrift = erg.selbst ? "Vergleiche mit der Musterlösung" :
        (erg.richtig === erg.gesamt ? "Richtig – stark gemacht!" :
          (erg.richtig > 0 ? erg.richtig + " von " + erg.gesamt + " richtig" : "Das stimmt noch nicht"));
      var box = h("div", { class: "ergebnis-box " + art }, [h("h3", { text: ueberschrift })]);
      if (erg.hinweis) box.appendChild(h("p", { html: erg.hinweis }));
      if (!erg.selbst) {
        box.appendChild(h("p", { text: erg.richtig === erg.gesamt ? "Unten siehst du noch den Lösungsweg zum Vergleich." : "Deine Eingaben bleiben stehen. Rot markiert ist, was nicht stimmt. Die richtige Lösung siehst du direkt daneben oder darunter." }));
      }
      var extra = ((a.typ === "mauer" || a.typ === "nonogramm") && erg.richtig !== erg.gesamt) ? h("div", { html: typ.loesungKurz(a) }) : null;
      box.appendChild(h("div", { class: "hilfe-box loesung" }, [h("span", { class: "label", text: "Lösungsweg" }), extra, h("div", { html: a.loesungsweg })]));
      ergebnisBereich.appendChild(box);
      if (erg.selbst && !arbeit.ergebnis) {
        var frage = h("div", { class: "stapel" }, [
          h("p", { html: "<strong>Wie gut passt deine Lösung?</strong>" }),
        ]);
        var reihe = h("div", { class: "knopfreihe" });
        [["Passt", "richtig"], ["Teilweise", "teilweise"], ["Noch nicht", "noch nicht"]].forEach(function (o) {
          reihe.appendChild(h("button", { class: "knopf leicht", type: "button", onclick: function () {
            arbeit.ergebnis = { kurz: o[1], richtig: 0, gesamt: 0, selbst: true };
            zustand.aufgaben[id] = kopie(arbeit); sichern();
            frage.remove(); toast("Eingetragen: " + o[1]);
          } }, [o[0]]));
        });
        frage.appendChild(reihe);
        ergebnisBereich.appendChild(frage);
      }
    }

    function pruefen() {
      var rangVorher = rangInfo(a.stufe).nr, medVorher = medaille(a.stufe, a.kat).art;
      abzeichenAktualisieren(false);
      var antworten = typ.lesen(ui);
      var erg = typ.pruefen(a, ui, antworten);
      arbeit.antworten = antworten;
      arbeit.status = "erledigt";
      arbeit.zuletzt = new Date().toISOString();
      if (!erg.selbst) {
        arbeit.ergebnis = { kurz: erg.richtig === erg.gesamt ? "richtig" : (erg.richtig + "/" + erg.gesamt + " richtig"), richtig: erg.richtig, gesamt: erg.gesamt };
      }
      if (arbeit.hilfen >= 3 && arbeit.ergebnis) arbeit.ergebnis.kurz += " (mit Lösung)";
      zustand.aufgaben[id] = kopie(arbeit);
      if (!erg.selbst && erg.gesamt > 0 && erg.richtig === erg.gesamt && arbeit.hilfen < 3 && !zustand.gesehen[id]) {
        zustand.gutschrift[id] = 1;
        if ((arbeit.hilfen || 0) === 0) zustand.ohneHilfe[id] = 1;
      }
      zustand.gesehen[id] = 1;
      sichern();
      erledigt = true;
      typ.sperren(ui);
      pruefKnopf.hidden = true; speicherKnopf.hidden = true; resetKnopf.hidden = false;
      hilfenZeigen();
      auswertungZeigen(erg);
      var rangNach = rangInfo(a.stufe), medNach = medaille(a.stufe, a.kat).art;
      var neueAbz = abzeichenAktualisieren(true);
      if (k1.badge) { var nb = rangAbzeichen(a.stufe, true); k1.badge.replaceWith(nb); k1.badge = nb; }
      if (rangNach.nr > rangVorher) {
        dialog("Neuer Rang: " + rangNach.name + "!", "Du hast in " + stufeNachId[a.stufe].name + " jetzt <strong>Rang " + rangNach.nr + " von 10</strong> erreicht. " +
          (rangNach.nr < 10 ? "Nächster Rang: „" + rangNach.naechsterName + "“." : "Mehr geht nicht – du bist ein echtes Mathe-Genie!"),
          [{ text: "Super!" }]);
      } else if (neueAbz.length) {
        dialog("Neues Abzeichen!", neueAbz.map(function (b) { return "<strong>" + b.name + "</strong>: " + b.text; }).join("<br>") +
          "<br><br>Alle Abzeichen findest du unter <strong>Meine Erfolge</strong>.", [{ text: "Super!" }]);
      } else if (medNach && medNach !== medVorher) {
        toast((medNach === "gold" ? "Gold" : "Silber") + " in „" + katNachId[a.kat].name + "“!");
      }
    }
    pruefKnopf.addEventListener("click", function () {
      var leer = typ.leer ? typ.leer(ui) : 0;
      if (leer > 0) {
        dialog("Noch nicht alles ausgefüllt", leer === 1 ? "Ein Feld ist noch leer. Trotzdem prüfen?" : leer + " Felder sind noch leer. Trotzdem prüfen?", [
          { text: "Trotzdem prüfen", aktion: pruefen },
          { text: "Weiterarbeiten", art: "zweit" },
        ]);
      } else pruefen();
    });
    resetKnopf.addEventListener("click", function () {
      dialog("Aufgabe neu starten?", "Deine Eingaben, das Ergebnis und der Schmierzettel dieser Aufgabe werden gelöscht.", [
        { text: "Neu starten", art: "warn", aktion: function () { delete zustand.aufgaben[id]; sichern(); schmierLoeschen(id); zeige("aufgabe", id); } },
        { text: "Abbrechen", art: "zweit" },
      ]);
    });

    hilfenZeigen();
    if (erledigt) {
      var erg = typ.pruefen(a, ui, arbeit.antworten);
      typ.sperren(ui);
      pruefKnopf.hidden = true; speicherKnopf.hidden = true; resetKnopf.hidden = false;
      auswertungZeigen(erg);
    }
  };

  // ------------------------------------------------------------ Aufgabentypen
  var TYPEN = {};

  // Eingabefelder (Zahl oder Text)
  TYPEN.eingabe = {
    bauen: function (a, wo, antw) {
      var felder = [];
      a.felder.forEach(function (f, i) {
        var fid = "f-" + i;
        var input = h("input", { class: "feld", id: fid, type: "text", autocomplete: "off", autocapitalize: "off", spellcheck: "false",
          inputmode: f.art === "text" ? "text" : "decimal", value: antw[fid] || "" });
        var rueck = h("span", { class: "rueck", hidden: true });
        wo.appendChild(h("div", { class: "antwortfeld" }, [
          h("label", { for: fid, html: f.label }),
          h("div", { class: "eingabe-zeile" }, [input, f.einheit ? h("span", { class: "einheit", html: f.einheit }) : null, rueck]),
        ]));
        felder.push({ input: input, rueck: rueck, def: f, id: fid });
      });
      return felder;
    },
    lesen: function (ui) { var o = {}; ui.forEach(function (f) { o[f.id] = f.input.value; }); return o; },
    leer: function (ui) { return ui.filter(function (f) { return !f.input.value.trim(); }).length; },
    pruefen: function (a, ui, antw) {
      var richtig = 0;
      ui.forEach(function (f) {
        var d = f.def, wert = antw[f.id] || "", ok;
        if (d.art === "text") {
          var liste = [d.wert].concat(d.alternativen || []);
          var norm = d.kompakt ? function (x) { return normText(x).replace(/[\u2212\u2013]/g, "-").replace(/\s+/g, ""); } : normText;
          ok = liste.some(function (x) { return norm(x) === norm(wert); });
        } else if (d.bereich) {
          var z = zahl(wert); ok = !isNaN(z) && z >= d.bereich[0] && z <= d.bereich[1];
        } else {
          var werte = [d.wert].concat(d.alternativen || []);
          ok = werte.some(function (w) { return gleich(zahl(wert), w, d.toleranz); });
        }
        if (ok) richtig++;
        f.input.value = wert;
        f.input.classList.remove("ok", "nein"); f.input.classList.add(ok ? "ok" : "nein");
        f.rueck.hidden = false;
        f.rueck.className = "rueck " + (ok ? "ok" : "nein");
        var richtigText = d.anzeige || (d.bereich ? "zwischen " + zahlAnzeige(d.bereich[0]) + " und " + zahlAnzeige(d.bereich[1]) : zahlAnzeige(d.wert));
        f.rueck.innerHTML = ok ? "✓ richtig" + (d.bereich ? " (sinnvoll: " + richtigText + ")" : "") : "✗ richtig wäre: " + richtigText + (d.einheit ? " " + d.einheit : "");
      });
      return { richtig: richtig, gesamt: ui.length };
    },
    sperren: function (ui) { ui.forEach(function (f) { f.input.readOnly = true; }); },
    loesungKurz: function (a) {
      return a.felder.map(function (f) {
        var t = f.anzeige || (f.bereich ? "zwischen " + zahlAnzeige(f.bereich[0]) + " und " + zahlAnzeige(f.bereich[1]) : zahlAnzeige(f.wert));
        return "<strong>" + f.label.replace(/<[^>]+>/g, "") + "</strong> " + t + (f.einheit ? " " + f.einheit : "");
      }).join("<br>");
    },
  };

  // Auswahl (eine richtige Antwort)
  TYPEN.auswahl = {
    bauen: function (a, wo, antw) {
      var box = h("div", { class: "optionen", role: "radiogroup", "aria-label": "Antwortmöglichkeiten" });
      var items = [];
      a.optionen.forEach(function (o, i) {
        var inp = h("input", { type: "radio", name: "wahl", id: "o-" + i, value: String(i) });
        if (String(antw.wahl) === String(i)) inp.checked = true;
        var lab = h("label", { class: "option", for: "o-" + i }, [inp, h("span", { html: o })]);
        box.appendChild(lab); items.push({ input: inp, label: lab });
      });
      wo.appendChild(box);
      return items;
    },
    lesen: function (ui) { var w = ui.filter(function (x) { return x.input.checked; })[0]; return { wahl: w ? w.input.value : "" }; },
    leer: function (ui) { return ui.some(function (x) { return x.input.checked; }) ? 0 : 1; },
    pruefen: function (a, ui, antw) {
      ui.forEach(function (x, i) {
        x.input.checked = String(antw.wahl) === String(i);
        x.label.classList.remove("ok", "nein");
        if (i === a.richtig) x.label.classList.add("ok");
        else if (String(antw.wahl) === String(i)) x.label.classList.add("nein");
      });
      return { richtig: String(antw.wahl) === String(a.richtig) ? 1 : 0, gesamt: 1 };
    },
    sperren: function (ui) { ui.forEach(function (x) { x.input.disabled = true; }); },
    loesungKurz: function (a) { return "<strong>Richtig ist:</strong> " + a.optionen[a.richtig]; },
  };

  // Offene Aufgabe mit Musterlösung und Selbsteinschätzung
  TYPEN.offen = {
    bauen: function (a, wo, antw) {
      var ta = h("textarea", { class: "feld", id: "offen", "aria-label": "Deine Antwort", placeholder: a.platzhalter || "Schreib hier deine Überlegungen und dein Ergebnis auf." });
      ta.value = antw.text || "";
      var eigen = h("div", { class: "vergleich", hidden: true });
      wo.appendChild(h("div", { class: "antwortfeld" }, [h("label", { for: "offen", text: "Deine Antwort" }), ta]));
      wo.appendChild(eigen);
      return { ta: ta, eigen: eigen };
    },
    lesen: function (ui) { return { text: ui.ta.value }; },
    leer: function (ui) { return ui.ta.value.trim() ? 0 : 1; },
    pruefen: function (a, ui, antw) {
      ui.ta.value = antw.text || "";
      ui.ta.hidden = true;
      ui.ta.previousSibling && (ui.ta.previousSibling.hidden = true);
      ui.eigen.hidden = false;
      ui.eigen.innerHTML = "";
      ui.eigen.appendChild(h("div", {}, [h("span", { class: "label", text: "Deine Antwort" }), h("div", { class: "eigener-text", text: antw.text || "(leer)" })]));
      ui.eigen.appendChild(h("div", {}, [h("span", { class: "label", text: "Musterlösung" }), h("div", { class: "eigener-text", html: a.muster })]));
      return { selbst: true, richtig: 0, gesamt: 0 };
    },
    sperren: function (ui) { ui.ta.readOnly = true; },
    loesungKurz: function (a) { return a.muster; },
  };

  // Gitter-Grundbau für Sudoku, KenKen, magische Quadrate
  function zellGroesse(n) {
    var verfuegbar = Math.min(window.innerWidth - 90, 560);
    return Math.max(30, Math.min(56, Math.floor(verfuegbar / n)));
  }
  function gitterBauen(n, opts, antw) {
    var z = opts.zelle || zellGroesse(n);
    var g = h("div", { class: "gitter", role: "grid", style: "grid-template-columns: repeat(" + n + ", " + z + "px); --z:" + z + "px" });
    var zellen = [];
    for (var r = 0; r < n; r++) {
      zellen.push([]);
      for (var c = 0; c < n; c++) {
        var cls = "zelle";
        if (opts.regionen) {
          if (c < n - 1 && opts.regionen[r][c] !== opts.regionen[r][c + 1]) cls += " r-rechts";
          if (r < n - 1 && opts.regionen[r][c] !== opts.regionen[r + 1][c]) cls += " r-unten";
          if (opts.toenung) cls += " reg-" + (opts.toenung[opts.regionen[r][c]] || 0);
        }
        var zelle = h("div", { class: cls, role: "gridcell" });
        var fest = opts.fest(r, c);
        var eintrag = { el: zelle, fest: fest !== null && fest !== undefined && fest !== "", input: null, r: r, c: c };
        if (eintrag.fest) zelle.appendChild(h("span", { class: "fest", text: String(fest) }));
        else {
          var key = r + "-" + c;
          var inp = h("input", { type: "text", inputmode: opts.inputmode || "numeric", maxlength: String(opts.maxlen || 1),
            "aria-label": "Zeile " + (r + 1) + ", Spalte " + (c + 1), autocomplete: "off", value: antw[key] || "" });
          inp.addEventListener("input", function (e) {
            var t = e.target; var erlaubt = opts.erlaubt || /[^1-9]/g;
            t.value = t.value.replace(erlaubt, "").slice(0, opts.maxlen || 1);
          });
          inp.addEventListener("keydown", pfeilNavigation);
          zelle.appendChild(inp);
          eintrag.input = inp; eintrag.key = key;
        }
        if (opts.beschriftung) { var b = opts.beschriftung(r, c); if (b) zelle.appendChild(h("span", { class: "kaefig", text: b })); }
        g.appendChild(zelle);
        zellen[r].push(eintrag);
      }
    }
    function pfeilNavigation(e) {
      var d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
      if (!d) return;
      var lab = e.target.getAttribute("aria-label").match(/\d+/g);
      var r = +lab[0] - 1, c = +lab[1] - 1;
      for (var s = 1; s < n; s++) {
        var rr = r + d[0] * s, cc = c + d[1] * s;
        if (rr < 0 || cc < 0 || rr >= n || cc >= n) break;
        if (zellen[rr][cc].input) { zellen[rr][cc].input.focus(); e.preventDefault(); break; }
      }
    }
    return { el: g, zellen: zellen, n: n, z: z };
  }
  function gitterLesen(gt) {
    var o = {};
    gt.zellen.forEach(function (row) { row.forEach(function (e) { if (e.input) o[e.key] = e.input.value; }); });
    return o;
  }
  function gitterLeer(gt) {
    var n = 0;
    gt.zellen.forEach(function (row) { row.forEach(function (e) { if (e.input && !e.input.value.trim()) n++; }); });
    return n;
  }
  function gitterSperren(gt) { gt.zellen.forEach(function (row) { row.forEach(function (e) { if (e.input) e.input.readOnly = true; }); }); }
  function zeichen(ch) { if (ch === "." || ch === undefined) return null; var v = parseInt(ch, 36); return v; }
  function loesungsGitter(n, loesung, opts) {
    var gt = gitterBauen(n, Object.assign({}, opts, { zelle: Math.max(26, Math.min(36, opts.zelle || 36)),
      fest: function (r, c) { return zeichen(loesung[r][c]); } }), {});
    return gt.el;
  }
  function gitterAuswerten(gt, soll) {
    var falsch = 0, gesamt = 0;
    gt.zellen.forEach(function (row) {
      row.forEach(function (e) {
        if (!e.input) return;
        gesamt++;
        var ok = String(e.input.value) === String(soll(e.r, e.c));
        e.el.classList.toggle("nein", !ok);
        if (!ok) falsch++;
      });
    });
    return { falsch: falsch, gesamt: gesamt };
  }

  function toenungFuer(regionen, n) {
    // Nur bei unregelmäßigen Gebieten einfärben: Nachbargebiete bekommen abwechselnd hell/dunkel
    var farbe = {}, anz = 0;
    for (var k = 0; k < n; k++) farbe[k] = -1;
    for (var k2 = 0; k2 < n; k2++) {
      var nachbarn = {};
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) {
        if (regionen[r][c] !== k2) continue;
        [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
          var rr = r + d[0], cc = c + d[1];
          if (rr >= 0 && cc >= 0 && rr < n && cc < n && regionen[rr][cc] !== k2) nachbarn[farbe[regionen[rr][cc]]] = true;
        });
      }
      farbe[k2] = nachbarn[0] ? 1 : 0; anz++;
    }
    return farbe;
  }

  function gitterTabelle(loesung) {
    return "<div class=\"abb\"><table style=\"font-family:var(--f-zahl)\">" + loesung.map(function (z) {
      return "<tr>" + z.split("").map(function (ch) { return "<td>" + zeichen(ch) + "</td>"; }).join("") + "</tr>";
    }).join("") + "</table></div>";
  }
  TYPEN.sudoku = {
    loesungKurz: function (a) { return gitterTabelle(a.loesung); },
    bauen: function (a, wo, antw) {
      var opts = { regionen: a.regionen, toenung: a.jigsaw ? toenungFuer(a.regionen, a.n) : null,
        fest: function (r, c) { return zeichen(a.vorgabe[r][c]); },
        erlaubt: new RegExp("[^1-" + a.n + "]", "g") };
      var gt = gitterBauen(a.n, opts, antw);
      var huelle = h("div", { class: "gitter-huelle" }, [gt.el]);
      var loes = h("div", { class: "gitter-paar", hidden: true });
      wo.appendChild(huelle); wo.appendChild(loes);
      gt.loes = loes; gt.opts = opts;
      return gt;
    },
    lesen: gitterLesen, leer: gitterLeer, sperren: gitterSperren,
    pruefen: function (a, gt, antw) {
      gt.zellen.forEach(function (row) { row.forEach(function (e) { if (e.input) e.input.value = antw[e.key] || ""; }); });
      var erg = gitterAuswerten(gt, function (r, c) { return zeichen(a.loesung[r][c]); });
      if (erg.falsch) {
        gt.loes.hidden = false; gt.loes.innerHTML = "";
        gt.loes.appendChild(h("div", {}, [h("span", { class: "label", text: "So sieht die Lösung aus" }), loesungsGitter(a.n, a.loesung, gt.opts)]));
      }
      var richtig = erg.gesamt - erg.falsch;
      return { richtig: richtig, gesamt: erg.gesamt, hinweis: erg.falsch ? erg.falsch + " Feld" + (erg.falsch === 1 ? "" : "er") + " stimmen noch nicht." : "" };
    },
  };

  TYPEN.kenken = {
    loesungKurz: function (a) { return gitterTabelle(a.loesung); },
    bauen: function (a, wo, antw) {
      var reg = []; for (var r = 0; r < a.n; r++) reg.push(new Array(a.n));
      var label = {};
      a.kaefige.forEach(function (k, i) {
        k.zellen.forEach(function (z) { reg[z[0]][z[1]] = i; });
        var erste = k.zellen.slice().sort(function (x, y) { return x[0] - y[0] || x[1] - y[1]; })[0];
        label[erste[0] + "-" + erste[1]] = k.ziel + (k.op || "");
      });
      var opts = { regionen: reg, fest: function () { return null; }, beschriftung: function (r, c) { return label[r + "-" + c]; },
        erlaubt: new RegExp("[^1-" + a.n + "]", "g") };
      var gt = gitterBauen(a.n, opts, antw);
      var loes = h("div", { class: "gitter-paar", hidden: true });
      wo.appendChild(h("div", { class: "gitter-huelle" }, [gt.el])); wo.appendChild(loes);
      gt.loes = loes; gt.opts = opts;
      return gt;
    },
    lesen: gitterLesen, leer: gitterLeer, sperren: gitterSperren,
    pruefen: function (a, gt, antw) {
      gt.zellen.forEach(function (row) { row.forEach(function (e) { if (e.input) e.input.value = antw[e.key] || ""; }); });
      var erg = gitterAuswerten(gt, function (r, c) { return zeichen(a.loesung[r][c]); });
      if (erg.falsch) {
        gt.loes.hidden = false; gt.loes.innerHTML = "";
        gt.loes.appendChild(h("div", {}, [h("span", { class: "label", text: "So sieht die Lösung aus" }), loesungsGitter(a.n, a.loesung, gt.opts)]));
      }
      return { richtig: erg.gesamt - erg.falsch, gesamt: erg.gesamt, hinweis: erg.falsch ? erg.falsch + " Feld" + (erg.falsch === 1 ? "" : "er") + " stimmen noch nicht." : "" };
    },
  };

  // Magisches Quadrat: geprüft wird die Eigenschaft, nicht eine bestimmte Lösung
  TYPEN.magisch = {
    bauen: function (a, wo, antw) {
      var opts = { zelle: Math.min(64, zellGroesse(a.n) + 8), maxlen: 6, inputmode: "text", erlaubt: /[^0-9,.\-−\/]/g,
        fest: function (r, c) { var v = a.vorgabe[r][c]; return v === null ? null : v; } };
      var gt = gitterBauen(a.n, opts, antw);
      var loes = h("div", { class: "gitter-paar", hidden: true });
      wo.appendChild(h("div", { class: "gitter-huelle" }, [gt.el])); wo.appendChild(loes);
      gt.loes = loes; gt.opts = opts;
      return gt;
    },
    lesen: gitterLesen, leer: gitterLeer, sperren: gitterSperren,
    pruefen: function (a, gt, antw) {
      var n = a.n, w = [];
      for (var r = 0; r < n; r++) {
        w.push([]);
        for (var c = 0; c < n; c++) {
          var e = gt.zellen[r][c];
          if (e.input) e.input.value = antw[e.key] || "";
          w[r].push(e.fest ? zahl(a.vorgabe[r][c]) : zahl(e.input.value));
        }
      }
      var summen = [];
      for (var i = 0; i < n; i++) {
        var zs = 0, ss = 0;
        for (var j = 0; j < n; j++) { zs += w[i][j]; ss += w[j][i]; }
        summen.push(zs, ss);
      }
      var d1 = 0, d2 = 0;
      for (var k = 0; k < n; k++) { d1 += w[k][k]; d2 += w[k][n - 1 - k]; }
      summen.push(d1, d2);
      var ziel = a.summe !== undefined ? a.summe : summen[0];
      var allesGleich = summen.every(function (s) { return gleich(s, ziel); });
      var zahlenOk = true;
      if (a.zahlen) {
        var ist = [].concat.apply([], w).map(function (x) { return Math.round(x * 1000) / 1000; }).sort(function (x, y) { return x - y; });
        var soll = a.zahlen.map(function (x) { return Math.round(x * 1000) / 1000; }).sort(function (x, y) { return x - y; });
        zahlenOk = JSON.stringify(ist) === JSON.stringify(soll);
      }
      var ok = allesGleich && zahlenOk && [].concat.apply([], w).every(function (x) { return !isNaN(x); });
      gt.zellen.forEach(function (row) { row.forEach(function (e) { if (e.input) e.el.classList.toggle("nein", !ok); }); });
      if (!ok) {
        gt.loes.hidden = false; gt.loes.innerHTML = "";
        gt.loes.appendChild(h("div", {}, [h("span", { class: "label", text: "Eine mögliche Lösung" }),
          loesungsGitter(n, a.loesung.map(function (row) { return row.map(String); }), { zelle: 52 })]));
      }
      var hinweis = ok ? "Alle Zeilen, Spalten und Diagonalen haben dieselbe Summe." :
        (!zahlenOk ? "Prüfe, ob du genau die vorgegebenen Zahlen verwendet hast." : "Nicht alle Zeilen, Spalten und Diagonalen haben die Summe " + zahlAnzeige(ziel) + ".");
      return { richtig: ok ? 1 : 0, gesamt: 1, hinweis: hinweis };
    },
  };
  // Lösungsgitter für magische Quadrate darf mehrstellige Werte zeigen
  var altZeichen = zeichen;
  zeichen = function (ch) { if (typeof ch === "string" && ch.length > 1) return ch; return altZeichen(ch); };

  // Rechenmauer / Zahlenpyramide
  TYPEN.mauer = {
    bauen: function (a, wo, antw) {
      var breite = a.reihen[a.reihen.length - 1].length;
      var s = Math.max(58, Math.min(84, Math.floor((Math.min(window.innerWidth, 620) - 80) / breite)));
      var m = h("div", { class: "mauer", style: "--s:" + s + "px" });
      var steine = [];
      a.reihen.forEach(function (reihe, r) {
        var zeile = h("div", { class: "mauer-reihe" });
        reihe.forEach(function (v, c) {
          var st = h("div", { class: "stein" });
          var e = { el: st, r: r, c: c, key: r + "-" + c };
          if (v !== null) st.appendChild(h("span", { class: "fest", text: String(v) }));
          else {
            e.input = h("input", { type: "text", inputmode: "text", "aria-label": "Reihe " + (r + 1) + ", Stein " + (c + 1), value: antw[e.key] || "", autocomplete: "off" });
            st.appendChild(e.input);
          }
          zeile.appendChild(st); steine.push(e);
        });
        m.appendChild(zeile);
      });
      wo.appendChild(h("div", { class: "gitter-huelle" }, [m]));
      return steine;
    },
    lesen: function (ui) { var o = {}; ui.forEach(function (e) { if (e.input) o[e.key] = e.input.value; }); return o; },
    leer: function (ui) { return ui.filter(function (e) { return e.input && !e.input.value.trim(); }).length; },
    sperren: function (ui) { ui.forEach(function (e) { if (e.input) e.input.readOnly = true; }); },
    pruefen: function (a, ui, antw) {
      var richtig = 0, gesamt = 0;
      ui.forEach(function (e) {
        if (!e.input) return;
        gesamt++;
        e.input.value = antw[e.key] || "";
        var soll = a.loesung[e.r][e.c];
        var ok = gleich(zahl(e.input.value), zahl(soll));
        e.el.classList.toggle("nein", !ok); e.el.classList.toggle("ok", ok);
        if (ok) richtig++;
        else e.input.title = "richtig: " + soll;
        if (!ok) {
          var alt = e.el.querySelector(".soll"); if (alt) alt.remove();
        }
      });
      var falsch = gesamt - richtig;
      var hinweis = falsch ? "Rot markierte Steine stimmen noch nicht. Die vollständige Mauer steht im Lösungsweg." : "";
      return { richtig: richtig, gesamt: gesamt, hinweis: hinweis };
    },
    loesungKurz: function (a) {
      return "<strong>Vollständige Mauer:</strong><div class=\"gitter-huelle\"><div class=\"mauer\" style=\"--s:58px\">" + a.loesung.map(function (r) {
        return "<div class=\"mauer-reihe\">" + r.map(function (v) { return "<div class=\"stein\" style=\"height:38px\"><span class=\"fest\">" + v + "</span></div>"; }).join("") + "</div>";
      }).join("") + "</div></div>";
    },
  };

  // Nonogramm: Tippen schaltet leer → ausgemalt → Kreuz → leer
  TYPEN.nonogramm = {
    bauen: function (a, wo, antw) {
      var R = a.zeilen.length, C = a.spalten.length;
      var maxZ = Math.max.apply(null, a.zeilen.map(function (z) { return z.length; }));
      var maxS = Math.max.apply(null, a.spalten.map(function (s) { return s.length; }));
      var nz = Math.max(22, Math.min(40, Math.floor((Math.min(window.innerWidth, 760) - 60 - maxZ * 18) / C)));
      var g = h("div", { class: "nono", style: "--n:" + nz + "px; grid-template-columns: auto repeat(" + C + ", " + nz + "px); grid-template-rows: auto repeat(" + R + ", " + nz + "px)" });
      g.appendChild(h("div", { class: "ecke" }));
      a.spalten.forEach(function (s) { g.appendChild(h("div", { class: "hs", style: "min-height:" + (maxS * 15 + 6) + "px" }, s.map(function (x) { return h("span", { text: String(x) }); }))); });
      var zellen = [];
      var stand0 = antw.felder || "";
      var modus = { wert: 1 };
      for (var r = 0; r < R; r++) {
        g.appendChild(h("div", { class: "hz" }, a.zeilen[r].map(function (x) { return h("span", { text: String(x) }); })));
        zellen.push([]);
        for (var c = 0; c < C; c++) {
          var cls = "nfeld" + ((c + 1) % 5 === 0 && c < C - 1 ? " r5" : "") + ((r + 1) % 5 === 0 && r < R - 1 ? " u5" : "");
          var b = h("button", { class: cls, type: "button", "aria-label": "Zeile " + (r + 1) + ", Spalte " + (c + 1) });
          var wert = parseInt(stand0.charAt(r * C + c) || "0", 10);
          (function (b, r, c) {
            b.dataset.wert = String(wert);
            b.addEventListener("click", function () {
              if (b.disabled) return;
              var w = parseInt(b.dataset.wert, 10);
              var neu = modus.wert === 1 ? (w === 1 ? 0 : 1) : (w === 2 ? 0 : 2);
              setze(b, neu);
            });
          })(b, r, c);
          setze(b, wert);
          g.appendChild(b); zellen[r].push(b);
        }
      }
      function setze(b, w) { b.dataset.wert = String(w); b.classList.toggle("voll", w === 1); b.classList.toggle("kreuz", w === 2); b.setAttribute("aria-pressed", w === 1 ? "true" : "false"); }
      var mknopf1 = h("button", { type: "button", "aria-pressed": "true" }, ["■ Ausmalen"]);
      var mknopf2 = h("button", { type: "button", "aria-pressed": "false" }, ["× Kreuz setzen"]);
      function mod(w) { modus.wert = w; mknopf1.setAttribute("aria-pressed", String(w === 1)); mknopf2.setAttribute("aria-pressed", String(w === 2)); }
      mknopf1.addEventListener("click", function () { mod(1); });
      mknopf2.addEventListener("click", function () { mod(2); });
      wo.appendChild(h("div", { class: "filter modus", role: "group", "aria-label": "Werkzeug" }, [mknopf1, mknopf2]));
      wo.appendChild(h("p", { class: "leise", text: "Kreuze sind nur eine Merkhilfe für Felder, die sicher leer bleiben." }));
      var rahmen = h("div", { class: "gitter-huelle" }, [g]);
      wo.appendChild(rahmen);
      var bild = h("p", { hidden: true });
      wo.appendChild(bild);
      return { zellen: zellen, R: R, C: C, bild: bild, setze: setze };
    },
    lesen: function (ui) {
      var s = "";
      ui.zellen.forEach(function (row) { row.forEach(function (b) { s += b.dataset.wert; }); });
      return { felder: s };
    },
    leer: function () { return 0; },
    sperren: function (ui) { ui.zellen.forEach(function (row) { row.forEach(function (b) { b.disabled = true; }); }); },
    pruefen: function (a, ui, antw) {
      var falsch = 0;
      var s = antw.felder || "";
      ui.zellen.forEach(function (row, r) {
        row.forEach(function (b, c) {
          var w = parseInt(s.charAt(r * ui.C + c) || "0", 10);
          ui.setze(b, w);
          var soll = a.loesung[r].charAt(c) === "#";
          var ist = w === 1;
          b.classList.toggle("nein", soll !== ist);
          if (soll !== ist) falsch++;
        });
      });
      ui.bild.hidden = false;
      ui.bild.innerHTML = falsch ? "" : "Das Bild zeigt: <strong>" + a.bild + "</strong>";
      return { richtig: falsch ? 0 : 1, gesamt: 1, hinweis: falsch ? falsch + " Feld" + (falsch === 1 ? " ist" : "er sind") + " falsch. Rot umrandet ist, was nicht stimmt. Das Bild zeigt: <strong>" + a.bild + "</strong>." : "" };
    },
    loesungKurz: function (a) {
      return "<strong>Das Bild zeigt: " + a.bild + "</strong><pre style=\"font-family:var(--f-zahl);line-height:1;margin:6px 0 0;overflow-x:auto\">" +
        a.loesung.map(function (z) { return z.replace(/#/g, "■").replace(/\./g, "·"); }).join("\n") + "</pre>";
    },
  };

  // ============================================================ Erfolge, Urkunde, Sicherung, Lehrkraft-Bereich
  var LK_HASH = "313126c2";                 // Passwort für den Lehrkraft-Bereich (nur Abschreckung, Seite ist öffentlich)
  var LK_KEY = "denkwerk.lehrkraft";
  var SIEGEL = "dw·Siegel·7f3a9c·Knobelwerk·2026";   // macht Urkunden-Codes und Sicherungen fälschungserschwert
  var B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

  // ------------------------------------------------------------ Kleine Helfer
  var skripte = {};
  function skriptLaden(src) {
    if (!skripte[src]) {
      skripte[src] = new Promise(function (ok, nein) {
        var el = document.createElement("script");
        el.src = src; el.async = true;
        el.onload = function () { ok(); };
        el.onerror = function () { delete skripte[src]; nein(new Error("Datei konnte nicht geladen werden: " + src)); };
        document.head.appendChild(el);
      });
    }
    return skripte[src];
  }
  function hash53(str) {   // cyrb53
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0, ch; i < str.length; i++) {
      ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507); h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507); h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }
  function siegel(text) { return hash53(SIEGEL + "|" + text); }
  var TAG0 = new Date(2026, 0, 1).getTime();
  function heuteTag() { var d = new Date(); return Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - TAG0) / 864e5); }
  function tagDatum(tag) { var d = new Date(TAG0); d.setDate(d.getDate() + tag); return d; }
  function datumKurz(d) { function zz(n) { return (n < 10 ? "0" : "") + n; } return zz(d.getDate()) + "." + zz(d.getMonth() + 1) + "." + d.getFullYear(); }
  function isoTag(d) { function zz(n) { return (n < 10 ? "0" : "") + n; } return d.getFullYear() + "-" + zz(d.getMonth() + 1) + "-" + zz(d.getDate()); }
  function nameNorm(n) { return String(n || "").trim().toLowerCase().replace(/\s+/g, " "); }
  function nameHash(n) { var x = nameNorm(n); return x ? (hash53("name|" + x) % 1023) + 1 : 0; }
  function basisUrl() { return location.href.split("#")[0].split("?")[0]; }
  function herunterladen(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = h("a", { href: url, download: name, style: "display:none" });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    return "geladen";
  }
  // Teilen-Menü des iPads (AirDrop, Mail, Teams …), sonst Download
  function dateiAnbieten(blob, name, titel) {
    var datei = null;
    try { datei = new File([blob], name, { type: blob.type }); } catch (e) { datei = null; }
    if (datei && navigator.canShare && navigator.share) {
      var geht = false;
      try { geht = navigator.canShare({ files: [datei] }); } catch (e) { geht = false; }
      if (geht) {
        return navigator.share({ files: [datei], title: titel }).then(function () { return "geteilt"; }, function (e) {
          if (e && e.name === "AbortError") return "abgebrochen";
          return herunterladen(blob, name);
        });
      }
    }
    return Promise.resolve(herunterladen(blob, name));
  }
  function base32(zahlen, laenge) {   // zahlen: BigInt
    var s = "", n = zahlen, f = BigInt(32);
    for (var i = 0; i < laenge; i++) { s = B32.charAt(Number(n % f)) + s; n = n / f; }
    return s;
  }
  function base32Lesen(text) {
    var s = String(text || "").toUpperCase().replace(/[\s-]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
    var n = BigInt(0), f = BigInt(32);
    for (var i = 0; i < s.length; i++) {
      var w = B32.indexOf(s.charAt(i));
      if (w < 0) return null;
      n = n * f + BigInt(w);
    }
    return { wert: n, laenge: s.length };
  }

  // ------------------------------------------------------------ Abzeichen
  // Reihenfolge nicht ändern (Bit-Position im Prüfcode). Neue Abzeichen nur hinten anhängen.
  var ABZEICHEN = [
    { id: "erster", name: "Erster Treffer", text: "Die erste Aufgabe richtig gelöst", sym: "1", test: function (s) { return s.geloest >= 1; } },
    { id: "zehn", name: "Zehnerpack", text: "10 Aufgaben richtig gelöst", sym: "10", test: function (s) { return s.geloest >= 10; } },
    { id: "fuenfzig", name: "Halbe Hundert", text: "50 Aufgaben richtig gelöst", sym: "50", test: function (s) { return s.geloest >= 50; } },
    { id: "hundert", name: "Hunderter-Club", text: "100 Aufgaben richtig gelöst", sym: "100", test: function (s) { return s.geloest >= 100; } },
    { id: "ohnenetz", name: "Ohne Netz", text: "10 Aufgaben richtig gelöst, ganz ohne Hilfe", sym: "✓", test: function (s) { return s.ohneHilfe >= 10; } },
    { id: "knifflig", name: "Kniffelprofi", text: "5 knifflige Aufgaben (★★★) richtig gelöst", sym: "★", test: function (s) { return s.knifflig >= 5; } },
    { id: "allrounder", name: "Allrounder", text: "In 10 verschiedenen Kategorien etwas richtig gelöst", sym: "✦", test: function (s) { return s.kategorien >= 10; } },
    { id: "entdecker", name: "Entdecker", text: "In einer Stufe jede Kategorie ausprobiert", sym: "◎", test: function (s) { return s.entdecker; } },
    { id: "silber", name: "Erstes Silber", text: "In einer Kategorie die Hälfte gelöst", sym: "S", test: function (s) { return s.silberOderGold >= 1; } },
    { id: "gold", name: "Erstes Gold", text: "Alle Aufgaben einer Kategorie gelöst", sym: "G", test: function (s) { return s.gold >= 1; } },
    { id: "goldschatz", name: "Goldschatz", text: "5 Goldmedaillen gesammelt", sym: "5G", test: function (s) { return s.gold >= 5; } },
    { id: "themenprofi", name: "Themenprofi", text: "Alle Aufgaben eines Unterrichtsthemas gelöst", sym: "T", test: function (s) { return s.themenprofi; } },
    { id: "halbzeit", name: "Halbzeit", text: "In einer Stufe Rang 5 erreicht", sym: "R5", test: function (s) { return s.maxRang >= 5; } },
    { id: "genie", name: "Mathe-Genie", text: "In einer Stufe Rang 10 erreicht", sym: "R10", test: function (s) { return s.maxRang >= 10; } },
  ];
  function statistik() {
    var ids = Object.keys(zustand.gutschrift).filter(function (id) { return aufgabeNachId[id]; });
    var kats = {}, knifflig = 0, ohne = 0;
    ids.forEach(function (id) {
      var a = aufgabeNachId[id];
      kats[a.kat] = 1;
      if (a.sterne === 3) knifflig++;
      if (zustand.ohneHilfe[id]) ohne++;
    });
    var st = { geloest: ids.length, ohneHilfe: ohne, knifflig: knifflig, kategorien: Object.keys(kats).length,
               silberOderGold: 0, gold: 0, maxRang: 0, entdecker: false, themenprofi: false };
    D.stufen.forEach(function (s) {
      var m = medaillenZahl(s.id);
      st.silberOderGold += m.silber + m.gold; st.gold += m.gold;
      st.maxRang = Math.max(st.maxRang, rangInfo(s.id).nr);
      var alle = kategorienVon(s.id).every(function (k) {
        return aufgabenVon(s.id, k.id).some(function (a) { return status(a.id) !== "offen" || geloest(a.id); });
      });
      if (alle) st.entdecker = true;
      themenVon(s.id).forEach(function (t) {
        if (t.id !== "kn" && anzahlGeloest(aufgabenVon(s.id, null, t.id)) === t.anzahl) st.themenprofi = true;
      });
    });
    return st;
  }
  // Neu verdiente Abzeichen eintragen. Ein einmal verdientes Abzeichen bleibt.
  function abzeichenAktualisieren(melden) {
    var st = statistik(), neu = [];
    ABZEICHEN.forEach(function (b) {
      if (!zustand.abzeichen[b.id] && b.test(st)) { zustand.abzeichen[b.id] = new Date().toISOString(); neu.push(b); }
    });
    if (neu.length) sichern();
    return melden ? neu : [];
  }
  function abzeichenMaske() {
    var m = 0;
    ABZEICHEN.forEach(function (b, i) { if (zustand.abzeichen[b.id]) m += Math.pow(2, i); });
    return m;
  }
  function abzeichenSymbol(b, hat) {
    return h("span", { class: "abz-sym" + (hat ? "" : " zu"), "aria-hidden": "true", text: b.sym });
  }

  // ------------------------------------------------------------ Prüfcode der Urkunde
  var CODE_FELDER = [["v", 3], ["stufe", 4], ["rang", 4], ["geloest", 9], ["silber", 5], ["gold", 5], ["abz", 16], ["tag", 13], ["name", 10]];
  function codeBauen(d) {
    var n = BigInt(0);
    CODE_FELDER.forEach(function (f) {
      var max = Math.pow(2, f[1]) - 1;
      n = n * BigInt(Math.pow(2, f[1])) + BigInt(Math.max(0, Math.min(max, d[f[0]] | 0)));
    });
    var mac = siegel("urkunde|" + n.toString(36)) % 2147483648;
    n = n * BigInt(2147483648) + BigInt(mac);
    return base32(n, 20).match(/.{5}/g).join("-");
  }
  function codeLesen(text) {
    var b = base32Lesen(text);
    if (!b || b.laenge !== 20) return null;
    var n = b.wert, zwei31 = BigInt(2147483648);
    var mac = Number(n % zwei31); n = n / zwei31;
    if (siegel("urkunde|" + n.toString(36)) % 2147483648 !== mac) return { gueltig: false };
    var d = { gueltig: true };
    for (var i = CODE_FELDER.length - 1; i >= 0; i--) {
      var f = BigInt(Math.pow(2, CODE_FELDER[i][1]));
      d[CODE_FELDER[i][0]] = Number(n % f); n = n / f;
    }
    if (d.v !== 1 || !D.stufen[d.stufe]) return { gueltig: false };
    return d;
  }
  function urkundeDaten(stufe, name) {
    var r = rangInfo(stufe), m = medaillenZahl(stufe);
    var d = { v: 1, stufe: D.stufen.indexOf(stufeNachId[stufe]), rang: r.nr, geloest: r.geloest, alle: r.alle,
              silber: m.silber, gold: m.gold, abz: abzeichenMaske(), tag: heuteTag(), name: nameHash(name) };
    d.code = codeBauen(d);
    return d;
  }

  // ------------------------------------------------------------ Urkunde als PDF (jsPDF, lokal mitgeliefert)
  function urkundenArt(rang) {
    if (rang >= 10) return { titel: "Ehrenurkunde", farbe: [107, 44, 145], akzent: [184, 134, 11], rahmen: 3, rosette: true, strahlen: true };
    if (rang >= 7) return { titel: "Goldurkunde", farbe: [176, 128, 14], akzent: [122, 86, 8], rahmen: 3, rosette: true };
    if (rang >= 4) return { titel: "Silberurkunde", farbe: [110, 122, 138], akzent: [66, 76, 92], rahmen: 2, rosette: true };
    if (rang >= 1) return { titel: "Urkunde", farbe: [160, 102, 43], akzent: [110, 66, 24], rahmen: 2, rosette: true };
    return { titel: "Erfolgsnachweis", farbe: [31, 61, 158], akzent: [31, 61, 158], rahmen: 1 };
  }
  function urkundePdf(d, name) {
    return Promise.all([skriptLaden("vendor/jspdf.umd.min.js"), skriptLaden("vendor/qrcode.js")]).then(function () {
      var doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
      var art = urkundenArt(d.rang), F = art.farbe, A = art.akzent, s = D.stufen[d.stufe];
      var W = 210, M = W / 2;
      function farbe(c) { doc.setDrawColor(c[0], c[1], c[2]); doc.setFillColor(c[0], c[1], c[2]); doc.setTextColor(c[0], c[1], c[2]); }
      function text(t, y, groesse, stil, c) { doc.setFont("helvetica", stil || "normal"); doc.setFontSize(groesse); farbe(c || [28, 34, 51]); doc.text(t, M, y, { align: "center" }); }
      function passend(t, maxBreite, groesse, stil) {
        doc.setFont("helvetica", stil || "normal");
        while (groesse > 10) { doc.setFontSize(groesse); if (doc.getTextWidth(t) <= maxBreite) break; groesse -= 1; }
        return groesse;
      }
      function raute(x, y, r) { doc.lines([[r, r], [-r, r], [-r, -r], [r, -r]], x, y - r, [1, 1], "F", true); }

      // Rahmen
      farbe(F); doc.setLineWidth(1.6); doc.rect(8, 8, W - 16, 281);
      doc.setLineWidth(0.4); doc.rect(11.5, 11.5, W - 23, 274);
      if (art.rahmen >= 3) { farbe(A); doc.setLineWidth(0.8); doc.rect(14, 14, W - 28, 269); }
      if (art.rahmen >= 2) {
        farbe(art.rahmen >= 3 ? A : F);
        [[11.5, 11.5], [W - 11.5, 11.5], [11.5, 285.5], [W - 11.5, 285.5]].forEach(function (p) { raute(p[0], p[1], 3.2); });
      }
      if (art.rahmen >= 3) {
        farbe(F);
        for (var x = 30; x <= W - 30; x += 10) { doc.circle(x, 11.5, 0.7, "F"); doc.circle(x, 285.5, 0.7, "F"); }
      }

      // Kopf mit Würfel-Logo
      var lx = M - 21, ly = 27;
      doc.setFillColor(31, 61, 158); doc.roundedRect(lx, ly - 5.5, 11, 11, 2.4, 2.4, "F");
      function poly(pts, c) {
        doc.setFillColor(c[0], c[1], c[2]);
        var rel = []; for (var i = 1; i < pts.length; i++) rel.push([pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]);
        doc.lines(rel, pts[0][0], pts[0][1], [1, 1], "F", true);
      }
      var k = 11 / 28, ox = lx - 2 * k, oy = ly - 5.5 - 2 * k;
      function P(px, py) { return [ox + px * k, oy + py * k]; }
      poly([P(16, 7), P(24.5, 11.5), P(16, 16), P(7.5, 11.5)], [255, 255, 255]);
      poly([P(7.5, 12.8), P(15.3, 17.2), P(15.3, 25.8), P(7.5, 21.4)], [197, 205, 230]);
      poly([P(24.5, 12.8), P(16.7, 17.2), P(16.7, 25.8), P(24.5, 21.4)], [143, 158, 207]);
      doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.setTextColor(31, 61, 158);
      doc.text("Denkwerk", lx + 14, ly + 2);

      // Rosette mit Rangnummer
      var y = 58;
      if (art.rosette) {
        farbe(A);
        doc.triangle(M - 9, y + 8, M - 3, y + 8, M - 11, y + 26, "F");
        doc.triangle(M + 3, y + 8, M + 9, y + 8, M + 11, y + 26, "F");
        if (art.strahlen) {
          for (var i = 0; i < 24; i++) {
            var w1 = (i / 24) * Math.PI * 2, w2 = w1 + Math.PI / 24, w3 = w1 - Math.PI / 24;
            doc.triangle(M + Math.cos(w1) * 19.5, y + Math.sin(w1) * 19.5, M + Math.cos(w2) * 13, y + Math.sin(w2) * 13, M + Math.cos(w3) * 13, y + Math.sin(w3) * 13, "F");
          }
        }
        farbe(F); doc.circle(M, y, 14.5, "F");
        doc.setDrawColor(255, 255, 255); doc.setLineWidth(0.6); doc.circle(M, y, 11.8, "S");
        doc.setFont("helvetica", "bold"); doc.setFontSize(24); doc.setTextColor(255, 255, 255);
        doc.text(String(d.rang), M, y + 3.2, { align: "center" });
        doc.setFontSize(6.5); doc.text("RANG", M, y - 6, { align: "center" });
      }
      y = art.rosette ? 100 : 66;
      text(art.titel, y, 36, "bold", F);
      text("für", y + 13, 13, "normal");
      var nm = String(name || "").trim();
      if (nm) {
        var g = passend(nm, 150, 26, "bold");
        text(nm, y + 27, g, "bold");
      } else {
        doc.setDrawColor(150, 155, 165); doc.setLineWidth(0.3); doc.line(M - 55, y + 27, M + 55, y + 27);
      }
      var inSt = (s.id === "EF" || s.id === "Q1" || s.id === "Q2") ? "in der " + s.name : "in " + s.name;
      if (d.rang > 0) {
        text("hat " + inSt + " den Rang", y + 42, 13, "normal");
        text(RAENGE[d.rang - 1], y + 57, passend(RAENGE[d.rang - 1], 160, 30, "bold"), "bold", A);
        text("Rang " + d.rang + " von 10", y + 66, 12, "normal", [91, 100, 120]);
      } else {
        text("knobelt " + inSt + " mit.", y + 42, 13, "normal");
        text("Der erste Rang wartet schon!", y + 54, 15, "bold", A);
      }

      // Kennzahlen
      var ky = y + 78;
      doc.setDrawColor(207, 214, 226); doc.setLineWidth(0.3); doc.setFillColor(246, 248, 252);
      doc.roundedRect(28, ky, W - 56, 26, 3, 3, "FD");
      var spalten = [[d.geloest + " von " + d.alle, "Aufgaben richtig gelöst", null], [d.silber + " ×", "Silber-Kategorien", [154, 165, 180]], [d.gold + " ×", "Gold-Kategorien", [212, 160, 23]]];
      spalten.forEach(function (sp, i) {
        var cx = 28 + (W - 56) * (i + 0.5) / 3;
        doc.setFont("helvetica", "bold"); doc.setFontSize(17); doc.setTextColor(28, 34, 51);
        var tw = doc.getTextWidth(sp[0]);
        if (sp[2]) { doc.setFillColor(sp[2][0], sp[2][1], sp[2][2]); doc.circle(cx - tw / 2 - 4.5, ky + 10.2, 2.6, "F"); }
        doc.text(sp[0], cx + (sp[2] ? 2 : 0), ky + 12, { align: "center" });
        doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(91, 100, 120);
        doc.text(sp[1], cx, ky + 19.5, { align: "center" });
      });

      // Abzeichen
      var ay = ky + 36;
      var hat = ABZEICHEN.filter(function (b, i) { return Math.floor(d.abz / Math.pow(2, i)) % 2 === 1; });
      text("Abzeichen: " + hat.length + " von " + ABZEICHEN.length, ay, 12, "bold");
      if (hat.length) {
        doc.setFont("helvetica", "normal"); doc.setFontSize(10);
        var sp3 = 3, bx = (W - 56) / sp3;
        hat.forEach(function (b, i) {
          var cx = 28 + (i % sp3) * bx + 6, cy = ay + 8 + Math.floor(i / sp3) * 7;
          farbe(F); doc.circle(cx, cy - 1.2, 1.6, "F");
          doc.setTextColor(28, 34, 51); doc.text(b.name, cx + 3.5, cy);
        });
      } else {
        text("Noch keine Abzeichen", ay + 8, 10, "normal", [91, 100, 120]);
      }

      // Fuß: Datum, Prüfcode, QR-Code
      var fy = 254;
      doc.setDrawColor(207, 214, 226); doc.setLineWidth(0.3); doc.line(22, fy - 6, W - 22, fy - 6);
      doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(91, 100, 120);
      doc.text("Erstellt am " + datumKurz(tagDatum(d.tag)), 22, fy);
      doc.text("Prüfcode", 22, fy + 8);
      doc.setFont("courier", "bold"); doc.setFontSize(13); doc.setTextColor(28, 34, 51);
      doc.text(d.code, 22, fy + 14);
      doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(91, 100, 120);
      doc.text(doc.splitTextToSize("Die Lehrkraft kann diese Urkunde mit dem Prüfcode oder dem QR-Code in Denkwerk prüfen (Bereich Für Lehrkräfte, dann Urkunde prüfen).", 120), 22, fy + 21);
      var qr = window.qrcode(0, "M");
      qr.addData(basisUrl() + "#pruefen=" + d.code.replace(/-/g, ""));
      qr.make();
      var n = qr.getModuleCount(), gr = 26, zs = gr / n, qx = W - 22 - gr, qy = fy - 3;
      doc.setFillColor(28, 34, 51);
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (qr.isDark(r, c)) doc.rect(qx + c * zs, qy + r * zs, zs + 0.02, zs + 0.02, "F");
      doc.setProperties({ title: art.titel + " Denkwerk – " + s.name, creator: "Denkwerk" });
      return doc.output("blob");
    });
  }

  // ------------------------------------------------------------ Ansicht: Meine Erfolge
  ANSICHTEN.erfolge = function (seite, stufe) {
    if (!stufeNachId[stufe]) stufe = zustand.stufe || D.stufen[0].id;
    abzeichenAktualisieren(false);
    var s = stufeNachId[stufe], r = rangInfo(stufe), m = medaillenZahl(stufe);
    seite.appendChild(kopf({ text: "Hauptmenü", aktion: function () { zeige("start"); } }, stufe, true));
    seite.appendChild(h("section", { class: "begruessung" }, [
      h("h1", { text: "Meine Erfolge" }),
      h("p", { text: "Rang und Medaillen gibt es für jede Stufe einzeln. Abzeichen sammelst du über alle Stufen hinweg." }),
    ]));
    var wahl = h("div", { class: "filter", role: "group", "aria-label": "Jahrgangsstufe wählen" });
    D.stufen.forEach(function (x) {
      wahl.appendChild(h("button", { type: "button", "aria-pressed": String(x.id === stufe), "aria-label": x.name, onclick: function () { zeige("erfolge", x.id); } }, [x.kurz]));
    });
    seite.appendChild(wahl);

    seite.appendChild(h("div", { class: "rangkarte sf" + D.stufen.indexOf(s), style: "margin-top:16px" }, [
      h("span", { class: "rang-nr gross-nr", "aria-hidden": "true", text: r.nr ? String(r.nr) : "–" }),
      h("div", { class: "stapel-eng" }, [
        h("span", { class: "label", text: "Dein Rang in " + s.name }),
        h("strong", { class: "rang-titel", text: r.name ? r.name + " (Rang " + r.nr + " von 10)" : "Noch kein Rang" }),
        h("span", { class: "leise", text: r.geloest + " von " + r.alle + " Aufgaben richtig gelöst. " + (r.nr === 10 ? "Höchster Rang erreicht!" :
          "Noch " + r.fehlen + " bis „" + r.naechsterName + "“.") }),
      ]),
      h("button", { class: "knopf zweit rk-knopf", type: "button", onclick: function () { zustand.stufe = stufe; sichern(); zeige("stufe", stufe); } }, ["Zu den Aufgaben"]),
    ]));

    // Medaillen
    var medKats = kategorienVon(stufe).map(function (k) { return { k: k, art: medaille(stufe, k.id).art }; }).filter(function (x) { return x.art; });
    var medBox = h("section", { class: "abschnitt" }, [
      h("h2", { text: "Medaillen in " + s.name }),
      h("div", { class: "medaillen-zahl" }, [
        h("span", { class: "rb-m silber gross", text: String(m.silber) }), h("span", { text: "Silber (Hälfte einer Kategorie gelöst)" }),
        h("span", { class: "rb-m gold gross", text: String(m.gold) }), h("span", { text: "Gold (ganze Kategorie gelöst)" }),
      ]),
    ]);
    if (medKats.length) {
      var ml = h("div", { class: "medaillen-liste" });
      medKats.forEach(function (x) { ml.appendChild(h("span", { class: "chip medaille " + x.art, text: (x.art === "gold" ? "🥇 " : "🥈 ") + x.k.name })); });
      medBox.appendChild(ml);
    } else {
      medBox.appendChild(h("p", { class: "leise", text: "Löse die Hälfte der Aufgaben einer Kategorie, dann bekommst du Silber." }));
    }
    seite.appendChild(medBox);

    // Abzeichen
    var hatAnz = ABZEICHEN.filter(function (b) { return zustand.abzeichen[b.id]; }).length;
    var raster = h("div", { class: "abzeichen-raster" });
    ABZEICHEN.forEach(function (b) {
      var hat = !!zustand.abzeichen[b.id];
      raster.appendChild(h("div", { class: "abz" + (hat ? " hat" : ""), "aria-label": b.name + (hat ? " (erreicht)" : " (noch nicht erreicht)") + ": " + b.text }, [
        abzeichenSymbol(b, hat),
        h("strong", { text: b.name }),
        h("span", { class: "leise", text: b.text }),
        hat ? h("span", { class: "abz-datum", text: "seit " + datumKurz(new Date(zustand.abzeichen[b.id])) }) : null,
      ]));
    });
    seite.appendChild(h("section", { class: "abschnitt" }, [h("h2", { text: "Abzeichen: " + hatAnz + " von " + ABZEICHEN.length }), raster]));

    // Urkunde
    var nameFeld = h("input", { class: "feld", id: "urk-name", type: "text", maxlength: "40", autocomplete: "off", autocapitalize: "words", spellcheck: "false", placeholder: "z. B. Lea M." });
    var ausgabe = h("div", { class: "stapel", "aria-live": "polite" });
    var knopf = h("button", { class: "knopf", type: "button" }, [(r.nr ? urkundenArt(r.nr).titel : "Erfolgsnachweis") + " als PDF erstellen"]);
    knopf.addEventListener("click", function () {
      knopf.disabled = true; ausgabe.innerHTML = "";
      ausgabe.appendChild(h("p", { class: "leise", text: "Die Urkunde wird erstellt …" }));
      var name = nameFeld.value.trim();
      var d = urkundeDaten(stufe, name);
      urkundePdf(d, name).then(function (blob) {
        ausgabe.innerHTML = "";
        var dateiname = "Denkwerk-" + urkundenArt(d.rang).titel + "-" + s.name.replace(/\s+/g, "-") + ".pdf";
        var url = URL.createObjectURL(blob);
        ausgabe.appendChild(h("div", { class: "ergebnis-box ok" }, [
          h("h3", { text: "Fertig: " + urkundenArt(d.rang).titel + " für " + s.name }),
          h("p", { html: "Prüfcode: <strong class=\"code\">" + d.code + "</strong>" }),
          h("div", { class: "knopfreihe" }, [
            h("button", { class: "knopf", type: "button", onclick: function () {
              dateiAnbieten(blob, dateiname, "Meine Denkwerk-Urkunde").then(function (e) { if (e === "geladen") toast("PDF heruntergeladen"); });
            } }, ["An Lehrkraft senden"]),
            h("a", { class: "knopf zweit", href: url, target: "_blank", rel: "noopener", download: dateiname }, ["PDF ansehen"]),
          ]),
          h("p", { class: "leise", text: "„An Lehrkraft senden“ öffnet das Teilen-Menü deines iPads. Wähle dort zum Beispiel AirDrop, Mail oder die App, die eure Schule nutzt." }),
        ]));
      }, function (err) {
        ausgabe.innerHTML = "";
        ausgabe.appendChild(h("div", { class: "ergebnis-box nein" }, [h("h3", { text: "Das hat nicht geklappt" }),
          h("p", { text: "Die Urkunde konnte nicht erstellt werden. Prüfe die Internetverbindung und versuche es noch einmal." }),
          h("p", { class: "leise", text: String(err && err.message || err) })]));
      }).then(function () { knopf.disabled = false; });
    });
    seite.appendChild(h("section", { class: "abschnitt" }, [
      h("h2", { text: "Erfolgsnachweis für deine Lehrkraft" }),
      h("div", { class: "blatt stapel" }, [
        h("p", { html: "Daraus wird eine Urkunde als PDF: dein Rang in <strong>" + s.name + "</strong>, deine Silber- und Goldmedaillen und deine Abzeichen. " +
          "Je höher dein Rang, desto edler die Urkunde: Urkunde ab Rang 1, Silberurkunde ab Rang 4, Goldurkunde ab Rang 7 und die Ehrenurkunde für Rang 10." }),
        h("div", { class: "antwortfeld" }, [
          h("label", { for: "urk-name", text: "Dein Name (freiwillig)" }),
          nameFeld,
          h("span", { class: "leise", style: "font-size:.88rem", text: "Der Name steht nur auf der Urkunde. Denkwerk speichert ihn nicht. Ohne Namen bleibt eine Linie frei." }),
        ]),
        h("div", { class: "knopfreihe" }, [knopf]),
        ausgabe,
      ]),
    ]));
    seite.appendChild(sicherungBereich());
  };

  // ------------------------------------------------------------ Fortschritt sichern
  function sicherungInhalt() {
    return { aufgaben: zustand.aufgaben, gutschrift: zustand.gutschrift, gesehen: zustand.gesehen, ohneHilfe: zustand.ohneHilfe,
             abzeichen: zustand.abzeichen, thema: zustand.thema, stufe: zustand.stufe };
  }
  function sicherungSpeichern() {
    var daten = sicherungInhalt();
    var paket = { app: "denkwerk", version: 1, erstellt: new Date().toISOString(), siegel: siegel(JSON.stringify(daten)).toString(36), daten: daten };
    var blob = new Blob([JSON.stringify(paket)], { type: "application/json" });
    var name = "Denkwerk-Sicherung-" + isoTag(new Date()) + ".json";
    return dateiAnbieten(blob, name, "Denkwerk-Sicherung").then(function (e) {
      if (e === "abgebrochen") return;
      zustand.letzteSicherung = new Date().toISOString(); sichern();
      toast(e === "geladen" ? "Sicherung heruntergeladen" : "Sicherung erstellt");
      if (aktuelleAnsicht) zeige(aktuelleAnsicht.name, aktuelleAnsicht.arg);
    });
  }
  function sicherungZusammenfuehren(d) {
    var neu = 0;
    ["gutschrift", "gesehen", "ohneHilfe"].forEach(function (feld) {
      Object.keys(d[feld] || {}).forEach(function (id) {
        if (!aufgabeNachId[id]) return;
        if (feld === "gutschrift" && !zustand.gutschrift[id]) neu++;
        zustand[feld][id] = 1;
      });
    });
    Object.keys(d.abzeichen || {}).forEach(function (id) {
      if (!zustand.abzeichen[id] || d.abzeichen[id] < zustand.abzeichen[id]) zustand.abzeichen[id] = d.abzeichen[id];
    });
    var rangfolge = { offen: 0, begonnen: 1, erledigt: 2 };
    Object.keys(d.aufgaben || {}).forEach(function (id) {
      var x = d.aufgaben[id], y = zustand.aufgaben[id];
      if (!aufgabeNachId[id] || !x || typeof x !== "object") return;
      if (!y || (rangfolge[x.status] || 0) > (rangfolge[y.status] || 0) ||
          ((rangfolge[x.status] || 0) === (rangfolge[y.status] || 0) && (x.zuletzt || "") > (y.zuletzt || ""))) zustand.aufgaben[id] = x;
    });
    Object.keys(d.thema || {}).forEach(function (st) { if (!zustand.thema[st]) zustand.thema[st] = d.thema[st]; });
    if (!zustand.stufe && d.stufe) zustand.stufe = d.stufe;
    sichern();
    return neu;
  }
  function sicherungLesen(datei) {
    var leser = new FileReader();
    leser.onload = function () {
      var paket = null;
      try { paket = JSON.parse(String(leser.result)); } catch (e) { paket = null; }
      if (!paket || paket.app !== "denkwerk" || !paket.daten) {
        dialog("Keine Denkwerk-Sicherung", "Diese Datei ist keine Sicherung von Denkwerk.", [{ text: "Ok" }]); return;
      }
      if (siegel(JSON.stringify(paket.daten)).toString(36) !== paket.siegel) {
        dialog("Sicherung verändert", "Diese Sicherung wurde nach dem Speichern verändert. Sie kann deshalb nicht geladen werden.", [{ text: "Ok" }]); return;
      }
      var anzahl = Object.keys(paket.daten.gutschrift || {}).length;
      dialog("Sicherung laden?", "Sicherung vom <strong>" + datumText(paket.erstellt) + "</strong> mit " + anzahl + " richtig gelösten Aufgaben. " +
        "Sie wird mit deinem jetzigen Stand <strong>zusammengeführt</strong>, es geht also nichts verloren.", [
        { text: "Ja, laden", aktion: function () {
          var neu = sicherungZusammenfuehren(paket.daten);
          abzeichenAktualisieren(false);
          toast(neu ? neu + " gelöste Aufgaben zurückgeholt" : "Sicherung geladen");
          zeige(aktuelleAnsicht ? aktuelleAnsicht.name : "start", aktuelleAnsicht ? aktuelleAnsicht.arg : undefined);
        } },
        { text: "Abbrechen", art: "zweit" },
      ]);
    };
    leser.readAsText(datei);
  }
  function sicherungBereich() {
    var eingabe = h("input", { type: "file", accept: ".json,application/json", hidden: true, "aria-hidden": "true" });
    eingabe.addEventListener("change", function () { if (eingabe.files && eingabe.files[0]) sicherungLesen(eingabe.files[0]); eingabe.value = ""; });
    return h("section", { class: "abschnitt sicherung" }, [
      h("h2", { text: "Fortschritt sichern" }),
      h("p", { class: "leise", text: "Safari kann gespeicherte Daten nach einiger Zeit löschen. Speichere deshalb ab und zu eine Sicherung, zum Beispiel in der Dateien-App. Damit holst du deinen Fortschritt zurück oder nimmst ihn auf ein anderes iPad mit." }),
      zustand.letzteSicherung ? h("p", { class: "leise", style: "font-size:.9rem", text: "Letzte Sicherung: " + datumText(zustand.letzteSicherung) }) : null,
      h("div", { class: "knopfreihe" }, [
        h("button", { class: "knopf leicht", type: "button", onclick: function () { sicherungSpeichern(); } }, ["Sicherung speichern"]),
        h("button", { class: "knopf zweit", type: "button", onclick: function () { eingabe.click(); } }, ["Sicherung laden"]),
      ]),
      eingabe,
    ]);
  }

  // ------------------------------------------------------------ Auftrag der Lehrkraft
  // Auftragscode: Version, Stufe, Thema, Kategorien (Bitmaske) und Prüfsumme in 8 Zeichen
  function auftragCode(a) {
    var st = D.stufen.indexOf(stufeNachId[a.s]);
    var th = a.t ? (TH.themen[a.s] || []).map(function (x) { return x[0]; }).indexOf(a.t) + 1 : 0;
    var maske = 0;
    (a.k || []).forEach(function (k) { var i = D.kategorien.indexOf(katNachId[k]); if (i >= 0) maske += Math.pow(2, i); });
    var n = ((1 * 16 + st) * 16 + th) * Math.pow(2, 23) + maske;     // 33 Bit
    var pruef = siegel("auftrag|" + n) % 32;
    return base32(BigInt(n) * BigInt(32) + BigInt(pruef), 8).replace(/^(.{4})/, "$1-");
  }
  function auftragLesen(text) {
    var b = base32Lesen(text);
    if (!b || b.laenge !== 8) return null;
    var pruef = Number(b.wert % BigInt(32)), n = Number(b.wert / BigInt(32));
    if (siegel("auftrag|" + n) % 32 !== pruef) return null;
    var maske = n % Math.pow(2, 23); n = Math.floor(n / Math.pow(2, 23));
    var th = n % 16; n = Math.floor(n / 16);
    var st = n % 16, v = Math.floor(n / 16);
    if (v !== 1 || !D.stufen[st]) return null;
    var s = D.stufen[st].id, themen = TH.themen[s] || [];
    var k = D.kategorien.filter(function (x, i) { return Math.floor(maske / Math.pow(2, i)) % 2 === 1; }).map(function (x) { return x.id; });
    return { s: s, t: th && themen[th - 1] ? themen[th - 1][0] : "", k: k };
  }
  function auftragAktiv() { var a = zustand.auftrag; return a && !a.weg && stufeNachId[a.s] ? a : null; }
  function auftragAufgaben(a) {
    return aufgabenVon(a.s, null, a.t).filter(function (x) { return !a.k || !a.k.length || a.k.indexOf(x.kat) >= 0; });
  }
  function auftragBeschreibung(a) {
    var teile = [stufeNachId[a.s].name];
    if (a.t) teile.push("Thema: " + themaName(a.s, a.t));
    if (a.k && a.k.length) teile.push(a.k.map(function (k) { return katNachId[k] ? katNachId[k].name : ""; }).filter(Boolean).join(", "));
    return teile.join(" · ");
  }
  function auftragOeffnen(a) {
    zustand.stufe = a.s; zustand.thema[a.s] = a.t || ""; sichern();
    if (a.k && a.k.length === 1) zeige("kategorie", { stufe: a.s, kat: a.k[0] }); else zeige("stufe", a.s);
  }
  function auftragUebernehmen(a) {
    a.erhalten = new Date().toISOString(); a.weg = false;
    zustand.auftrag = a; sichern();
  }
  function auftragBanner(seite) {
    var a = auftragAktiv();
    if (!a) return;
    var auf = auftragAufgaben(a), g = anzahlGeloest(auf);
    var banner = h("section", { class: "auftrag-banner", "aria-label": "Auftrag von deiner Lehrkraft" }, [
      h("div", { class: "stapel-eng" }, [
        h("span", { class: "label", text: "Auftrag von deiner Lehrkraft" }),
        h("strong", { text: auftragBeschreibung(a) }),
        h("span", { class: "leise", text: g + " von " + auf.length + " Aufgaben richtig gelöst. Alle anderen Aufgaben kannst du trotzdem bearbeiten." }),
      ]),
      h("div", { class: "knopfreihe" }, [
        h("button", { class: "knopf", type: "button", onclick: function () { auftragOeffnen(a); } }, ["Zum Auftrag"]),
        h("button", { class: "knopf zweit", type: "button", onclick: function () {
          dialog("Auftrag ausblenden?", "Der Hinweis verschwindet. Mit einem neuen Link oder Code deiner Lehrkraft erscheint wieder ein Auftrag.", [
            { text: "Ausblenden", aktion: function () { a.weg = true; sichern(); banner.remove(); } },
            { text: "Abbrechen", art: "zweit" },
          ]);
        } }, ["Ausblenden"]),
      ]),
    ]);
    var kopfEl = seite.querySelector(".kopf");
    seite.insertBefore(banner, kopfEl ? kopfEl.nextSibling : seite.firstChild);
  }
  function auftragscodeDialog() {
    var feld = h("input", { class: "feld", type: "text", maxlength: "12", autocomplete: "off", autocapitalize: "characters", spellcheck: "false", placeholder: "z. B. 4K2P-9XQA", "aria-label": "Auftragscode" });
    var fehler = h("p", { class: "fehler", role: "alert", hidden: true });
    var schleier = h("div", { class: "schleier" });
    function zu() { schleier.remove(); }
    function los() {
      var a = auftragLesen(feld.value);
      if (!a) { fehler.hidden = false; fehler.textContent = "Dieser Code stimmt nicht. Prüfe ihn noch einmal."; return; }
      auftragUebernehmen(a); zu(); toast("Auftrag übernommen"); auftragOeffnen(a);
    }
    feld.addEventListener("keydown", function (e) { if (e.key === "Enter") los(); });
    schleier.appendChild(h("div", { class: "dialog", role: "dialog", "aria-modal": "true", "aria-label": "Auftragscode eingeben" }, [
      h("h2", { text: "Auftragscode eingeben" }),
      h("p", { text: "Deine Lehrkraft zeigt dir einen Code mit 8 Zeichen. Tippe ihn hier ein." }),
      feld, fehler,
      h("div", { class: "knopfreihe" }, [
        h("button", { class: "knopf", type: "button", onclick: los }, ["Übernehmen"]),
        h("button", { class: "knopf zweit", type: "button", onclick: zu }, ["Abbrechen"]),
      ]),
    ]));
    schleier.addEventListener("click", function (e) { if (e.target === schleier) zu(); });
    document.body.appendChild(schleier);
    setTimeout(function () { feld.focus(); }, 30);
  }

  // ------------------------------------------------------------ Lehrkraft-Bereich
  var lkSitzung = false;
  function lkAngemeldet() {
    try { return window.localStorage.getItem(LK_KEY) === LK_HASH || lkSitzung; } catch (e) { return lkSitzung; }
  }
  function lkZurueck() { return { text: zustand.auth ? "Schüleransicht" : "Anmeldung", aktion: function () { zeige(zustand.auth ? "start" : "anmeldung"); } }; }
  function lkKopf(seite, zurueckZumMenue) {
    var k = kopf(zurueckZumMenue ? { text: "Lehrkraft-Bereich", aktion: function () { zeige("lehrkraft"); } } : lkZurueck(), null);
    k.classList.add("nicht-drucken");
    seite.appendChild(k);
  }
  function auswahlFeld(id, optionen, wert) {
    var sel = h("select", { class: "feld", id: id });
    optionen.forEach(function (o) { var op = h("option", { value: o[0], text: o[1] }); if (o[0] === wert) op.selected = true; sel.appendChild(op); });
    return sel;
  }
  function stufenOptionen() { return D.stufen.map(function (s) { return [s.id, s.name]; }); }
  function themenOptionen(stufe) { return [["", "Alle Themen"]].concat(themenVon(stufe).map(function (t) { return [t.id, t.name + " (" + t.anzahl + ")"]; })); }

  ANSICHTEN.lehrkraft = function (seite) {
    if (!lkAngemeldet()) {
      lkKopf(seite, false);
      var eingabe = h("input", { class: "feld", id: "lk-pw", type: "password", autocomplete: "current-password", placeholder: "Passwort" });
      var fehler = h("p", { class: "fehler", role: "alert", hidden: true });
      var form = h("form", { novalidate: true, class: "stapel" }, [
        h("label", { for: "lk-pw", class: "label", text: "Passwort für Lehrkräfte" }), eingabe, fehler,
        h("button", { class: "knopf", type: "submit" }, ["Anmelden"]),
      ]);
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (fnv(eingabe.value.trim()) === LK_HASH) {
          lkSitzung = true;
          try { window.localStorage.setItem(LK_KEY, LK_HASH); } catch (err) { /* nur für diese Sitzung */ }
          zeige("lehrkraft");
        } else { fehler.hidden = false; fehler.textContent = "Das Passwort stimmt nicht."; eingabe.select(); }
      });
      seite.appendChild(h("div", { class: "anmeldung", style: "margin-top:4vh" }, [h("div", { class: "blatt stapel" }, [
        h("h1", { text: "Für Lehrkräfte" }),
        h("p", { class: "leise", text: "Hier erstellst du Aufträge für deine Klasse, druckst Arbeitsblätter und prüfst Urkunden." }),
        form,
        h("button", { class: "knopf leicht", type: "button", onclick: function () { zeige("pruefen", ""); } }, ["Nur eine Urkunde prüfen"]),
      ])]));
      setTimeout(function () { eingabe.focus(); }, 50);
      return;
    }
    lkKopf(seite, false);
    seite.appendChild(h("section", { class: "begruessung" }, [
      h("span", { class: "label", text: "Lehrkraft-Bereich" }),
      h("h1", { text: "Was möchtest du tun?" }),
    ]));
    var karten = [
      ["Auftrag für die Klasse", "Link, QR-Code und Code mit 8 Zeichen. Den Schülerinnen und Schülern wird oben angezeigt, was sie bearbeiten sollen. Alle anderen Aufgaben bleiben frei.", "lkAuftrag"],
      ["Arbeitsblatt drucken", "Aufgaben nach Stufe, Thema und Kategorie auswählen und als Arbeitsblatt drucken oder als PDF sichern, auf Wunsch mit Lösungen.", "lkDruck"],
      ["Urkunde prüfen", "Prüfcode einer Urkunde eingeben oder den QR-Code auf der Urkunde mit der iPad-Kamera scannen.", "pruefen"],
      ["Klassenübersicht", "Prüfcodes der Urkunden pro Klasse sammeln: Rang, gelöste Aufgaben, Medaillen und Abzeichen auf einen Blick. Die Liste bleibt auf diesem Gerät.", "lkKlassen"],
    ];
    var liste = h("div", { class: "liste" });
    karten.forEach(function (k) {
      liste.appendChild(h("button", { class: "eintrag", type: "button", onclick: function () { zeige(k[2], k[2] === "pruefen" ? "" : undefined); } }, [
        h("span", { class: "sym", "aria-hidden": "true", text: k[0].charAt(0) }),
        h("span", { class: "mitte" }, [h("span", { class: "titel", text: k[0] }), h("span", { class: "unter", text: k[1] })]),
        h("span", { class: "stand", "aria-hidden": "true", text: "→" }),
      ]));
    });
    seite.appendChild(liste);
    seite.appendChild(h("footer", { class: "fuss" }, [
      h("button", { type: "button", onclick: function () {
        lkSitzung = false; try { window.localStorage.removeItem(LK_KEY); } catch (e) { /* egal */ }
        toast("Abgemeldet"); zeige(zustand.auth ? "start" : "anmeldung");
      } }, ["Lehrkraft-Bereich auf diesem Gerät abmelden"]),
    ]));
  };

  ANSICHTEN.lkAuftrag = function (seite, w) {
    if (!lkAngemeldet()) { zeige("lehrkraft"); return; }
    w = w || { s: zustand.stufe || D.stufen[0].id, t: "", k: [] };
    lkKopf(seite, true);
    seite.appendChild(h("section", { class: "begruessung" }, [
      h("span", { class: "label", text: "Lehrkraft-Bereich" }), h("h1", { text: "Auftrag für die Klasse" }),
      h("p", { text: "Wähle Stufe, Thema und auf Wunsch einzelne Kategorien. Ohne Kategorien gehört das ganze Thema zum Auftrag." }),
    ]));
    var selStufe = auswahlFeld("a-stufe", stufenOptionen(), w.s);
    var selThema = auswahlFeld("a-thema", themenOptionen(w.s), w.t);
    function neu() { zeige("lkAuftrag", { s: selStufe.value, t: selStufe.value === w.s ? selThema.value : "", k: selStufe.value === w.s ? w.k : [] }); }
    selStufe.addEventListener("change", neu);
    selThema.addEventListener("change", function () { w.t = selThema.value; neu(); });
    var katBox = h("div", { class: "kat-wahl" });
    kategorienVon(w.s).forEach(function (k) {
      var n = aufgabenVon(w.s, k.id, w.t).length;
      if (!n) return;
      var cb = h("input", { type: "checkbox", value: k.id });
      if (w.k.indexOf(k.id) >= 0) cb.checked = true;
      cb.addEventListener("change", function () {
        w.k = Array.prototype.slice.call(katBox.querySelectorAll("input:checked")).map(function (x) { return x.value; });
        umfang.textContent = umfangText();
      });
      katBox.appendChild(h("label", { class: "option" }, [cb, h("span", { text: k.name + " (" + n + ")" })]));
    });
    function umfangText() { return "Zum Auftrag gehören " + auftragAufgaben(w).length + " Aufgaben."; }
    var umfang = h("p", { class: "leise", text: umfangText() });
    var ausgabe = h("div", { class: "stapel" });
    seite.appendChild(h("div", { class: "blatt stapel" }, [
      h("div", { class: "antwortfeld" }, [h("label", { for: "a-stufe", text: "Jahrgangsstufe" }), selStufe]),
      h("div", { class: "antwortfeld" }, [h("label", { for: "a-thema", text: "Thema aus dem Unterricht" }), selThema]),
      h("div", { class: "antwortfeld" }, [h("span", { class: "label-fett", text: "Kategorien (freiwillig)" }), katBox]),
      umfang,
      h("div", { class: "knopfreihe" }, [h("button", { class: "knopf", type: "button", onclick: function () {
        var code = auftragCode(w), link = basisUrl() + "#auftrag=" + code.replace("-", "");
        ausgabe.innerHTML = "";
        var linkFeld = h("input", { class: "feld", type: "text", readonly: true, value: link, "aria-label": "Link zum Auftrag" });
        var qrBox = h("div", { class: "qr", "aria-label": "QR-Code zum Auftrag", role: "img" });
        skriptLaden("vendor/qrcode.js").then(function () {
          var qr = window.qrcode(0, "M"); qr.addData(link); qr.make();
          qrBox.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 3, scalable: true });
        }, function () { qrBox.textContent = "QR-Code konnte nicht geladen werden."; });
        ausgabe.appendChild(h("div", { class: "ergebnis-box ok" }, [
          h("h3", { text: auftragBeschreibung(w) }),
          h("div", { class: "auftrag-ausgabe" }, [
            qrBox,
            h("div", { class: "stapel" }, [
              h("div", {}, [h("span", { class: "label", text: "Auftragscode" }), h("div", { class: "grosscode", text: code })]),
              h("p", { text: "Scannen mit der iPad-Kamera öffnet Denkwerk in Safari. Wer Denkwerk als App auf dem Home-Bildschirm nutzt, tippt den Code dort auf der Startseite unter „Auftragscode eingeben“ ein." }),
              linkFeld,
              h("div", { class: "knopfreihe" }, [
                h("button", { class: "knopf leicht", type: "button", onclick: function () {
                  var fertig = function () { toast("Link kopiert"); };
                  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(fertig, function () { linkFeld.select(); });
                  else { linkFeld.select(); try { document.execCommand("copy"); fertig(); } catch (e) { /* markiert */ } }
                } }, ["Link kopieren"]),
                h("button", { class: "knopf zweit", type: "button", onclick: function () {
                  var gross = h("div", { class: "schleier beamer" }, [h("div", { class: "dialog beamer-box" }, [
                    h("div", { class: "qr gross", html: qrBox.innerHTML }),
                    h("div", { class: "grosscode", text: code }),
                    h("p", { class: "leise", text: auftragBeschreibung(w) }),
                    h("button", { class: "knopf", type: "button", onclick: function () { gross.remove(); } }, ["Schließen"]),
                  ])]);
                  document.body.appendChild(gross);
                } }, ["Groß zeigen (Beamer)"]),
              ]),
            ]),
          ]),
        ]));
      } }, ["Link, QR-Code und Code erzeugen"])]),
      ausgabe,
    ]));
  };

  ANSICHTEN.lkDruck = function (seite, w) {
    if (!lkAngemeldet()) { zeige("lehrkraft"); return; }
    w = w || { s: zustand.stufe || D.stufen[0].id, t: "", k: "", ids: [], loes: true, hilfen: false };
    lkKopf(seite, true);
    seite.appendChild(h("section", { class: "begruessung" }, [
      h("span", { class: "label", text: "Lehrkraft-Bereich" }), h("h1", { text: "Arbeitsblatt drucken" }),
      h("p", { text: "Wähle die Aufgaben aus. Danach siehst du das Arbeitsblatt und kannst es drucken oder als PDF sichern." }),
    ]));
    var selStufe = auswahlFeld("d-stufe", stufenOptionen(), w.s);
    var selThema = auswahlFeld("d-thema", themenOptionen(w.s), w.t);
    var katOpt = [["", "Alle Kategorien"]].concat(kategorienVon(w.s).filter(function (k) { return aufgabenVon(w.s, k.id, w.t).length; }).map(function (k) { return [k.id, k.name]; }));
    var selKat = auswahlFeld("d-kat", katOpt, w.k);
    function neu(stufeNeu) { zeige("lkDruck", { s: selStufe.value, t: stufeNeu ? "" : selThema.value, k: stufeNeu ? "" : selKat.value, ids: stufeNeu ? [] : w.ids, loes: cbLoes.checked, hilfen: cbHilfe.checked }); }
    selStufe.addEventListener("change", function () { neu(true); });
    selThema.addEventListener("change", function () { selKat.value = ""; neu(false); });
    selKat.addEventListener("change", function () { neu(false); });
    var cbLoes = h("input", { type: "checkbox", id: "d-loes" }); cbLoes.checked = w.loes;
    var cbHilfe = h("input", { type: "checkbox", id: "d-hilfe" }); cbHilfe.checked = w.hilfen;
    var kandidaten = aufgabenVon(w.s, w.k || null, w.t);
    var liste = h("div", { class: "kat-wahl druck-wahl" });
    var zaehler = h("p", { class: "leise" });
    function gewaehlt() { return Array.prototype.slice.call(liste.querySelectorAll("input:checked")).map(function (x) { return x.value; }); }
    function zaehlen() { w.ids = gewaehlt(); zaehler.textContent = w.ids.length + " von " + kandidaten.length + " Aufgaben ausgewählt"; zeigen.disabled = !w.ids.length; }
    kandidaten.forEach(function (a) {
      var cb = h("input", { type: "checkbox", value: a.id });
      if (w.ids.indexOf(a.id) >= 0) cb.checked = true;
      cb.addEventListener("change", zaehlen);
      liste.appendChild(h("label", { class: "option" }, [cb, h("span", {}, [h("strong", { text: a.titel }), h("br"),
        h("span", { class: "leise", text: katNachId[a.kat].name + " · " + sterne(a.sterne) })])]));
    });
    var zeigen = h("button", { class: "knopf", type: "button", onclick: function () {
      zeige("druck", { ids: gewaehlt(), loes: cbLoes.checked, hilfen: cbHilfe.checked, s: w.s, t: w.t, k: w.k });
    } }, ["Arbeitsblatt anzeigen"]);
    function setzeAlle(werte) {
      Array.prototype.forEach.call(liste.querySelectorAll("input"), function (x) { x.checked = werte.indexOf(x.value) >= 0; });
      zaehlen();
    }
    seite.appendChild(h("div", { class: "blatt stapel" }, [
      h("div", { class: "druck-filter" }, [
        h("div", { class: "antwortfeld" }, [h("label", { for: "d-stufe", text: "Jahrgangsstufe" }), selStufe]),
        h("div", { class: "antwortfeld" }, [h("label", { for: "d-thema", text: "Thema" }), selThema]),
        h("div", { class: "antwortfeld" }, [h("label", { for: "d-kat", text: "Kategorie" }), selKat]),
      ]),
      h("div", { class: "knopfreihe" }, [
        h("button", { class: "knopf leicht", type: "button", onclick: function () {
          var ids = kandidaten.map(function (a) { return a.id; }), zuf = [];
          while (ids.length && zuf.length < 5) zuf.push(ids.splice(Math.floor(Math.random() * ids.length), 1)[0]);
          setzeAlle(zuf);
        } }, ["5 zufällig"]),
        h("button", { class: "knopf leicht", type: "button", onclick: function () { setzeAlle(kandidaten.map(function (a) { return a.id; })); } }, ["Alle"]),
        h("button", { class: "knopf leicht", type: "button", onclick: function () { setzeAlle([]); } }, ["Keine"]),
      ]),
      zaehler,
      liste,
      h("label", { class: "option" }, [cbLoes, h("span", { text: "Lösungen auf eigenen Seiten anhängen" })]),
      h("label", { class: "option" }, [cbHilfe, h("span", { text: "Hilfen 1 und 2 unter den Aufgaben abdrucken" })]),
      h("div", { class: "knopfreihe" }, [zeigen]),
    ]));
    zaehlen();
  };

  ANSICHTEN.druck = function (seite, w) {
    if (!lkAngemeldet()) { zeige("lehrkraft"); return; }
    var aufgaben = (w.ids || []).map(function (id) { return aufgabeNachId[id]; }).filter(Boolean);
    document.body.classList.add("druckmodus");
    seite.appendChild(h("div", { class: "druck-leiste nicht-drucken" }, [
      h("button", { class: "zurueck", type: "button", onclick: function () { document.body.classList.remove("druckmodus"); zeige("lkDruck", w); } }, ["← Auswahl ändern"]),
      h("button", { class: "knopf", type: "button", onclick: function () { window.print(); } }, ["Drucken oder als PDF sichern"]),
      h("p", { class: "leise", text: "Im Druckmenü kannst du das Blatt auch als PDF sichern." }),
    ]));
    var titel = stufeNachId[w.s] ? stufeNachId[w.s].name : "";
    if (w.t) titel += " · Thema: " + themaName(w.s, w.t);
    var blatt = h("div", { class: "druckblatt" }, [
      h("header", { class: "druck-kopf" }, [
        h("div", {}, [h("strong", { text: "Denkwerk · Zusatzaufgaben" }), h("br"), h("span", { text: titel })]),
        h("div", { class: "druck-name" }, [h("span", { text: "Name: ______________________" }), h("span", { text: "Datum: ____________" })]),
      ]),
    ]);
    aufgaben.forEach(function (a, i) {
      var box = h("section", { class: "druck-aufgabe" }, [
        h("div", { class: "druck-meta", text: "Aufgabe " + (i + 1) + " · " + katNachId[a.kat].name + " · " + sterne(a.sterne) }),
        h("h2", { text: a.titel }),
        h("div", { class: "aufgabentext", html: a.text }),
      ]);
      var antw = h("div", { class: "antworten" });
      box.appendChild(antw);
      try { TYPEN[a.typ].bauen(a, antw, {}); } catch (e) { antw.appendChild(h("p", { class: "leise", text: "(Antwortfelder konnten nicht dargestellt werden)" })); }
      if (w.hilfen) (a.hilfen || []).slice(0, 2).forEach(function (t, j) {
        box.appendChild(h("div", { class: "hilfe-box" }, [h("span", { class: "label", text: "Hilfe " + (j + 1) }), h("div", { html: t })]));
      });
      blatt.appendChild(box);
    });
    if (w.loes) {
      var loes = h("section", { class: "loesungsteil" }, [h("h2", { text: "Lösungen" })]);
      aufgaben.forEach(function (a, i) {
        var typ = TYPEN[a.typ];
        loes.appendChild(h("div", { class: "druck-loesung" }, [
          h("h3", { text: "Aufgabe " + (i + 1) + ": " + a.titel }),
          typ.loesungKurz ? h("div", { html: typ.loesungKurz(a) }) : null,
          h("div", { html: a.loesungsweg }),
        ]));
      });
      blatt.appendChild(loes);
    }
    seite.appendChild(blatt);
  };

  ANSICHTEN.pruefen = function (seite, code) {
    var k = kopf(lkAngemeldet() ? { text: "Lehrkraft-Bereich", aktion: function () { zeige("lehrkraft"); } } : lkZurueck(), null);
    seite.appendChild(k);
    seite.appendChild(h("section", { class: "begruessung" }, [
      h("span", { class: "label", text: "Für Lehrkräfte" }), h("h1", { text: "Urkunde prüfen" }),
      h("p", { text: "Gib den Prüfcode von der Urkunde ein. Wenn du willst, auch den Namen auf der Urkunde. Dann siehst du, ob Urkunde und Code zusammenpassen." }),
    ]));
    var codeFeld = h("input", { class: "feld code", id: "p-code", type: "text", autocomplete: "off", autocapitalize: "characters", spellcheck: "false", value: code || "", placeholder: "XXXXX-XXXXX-XXXXX-XXXXX" });
    var nameFeld = h("input", { class: "feld", id: "p-name", type: "text", autocomplete: "off", spellcheck: "false", placeholder: "freiwillig" });
    var ausgabe = h("div", { class: "stapel", "aria-live": "polite" });
    function pruefe() {
      ausgabe.innerHTML = "";
      var d = codeLesen(codeFeld.value);
      if (!d || !d.gueltig) {
        ausgabe.appendChild(h("div", { class: "ergebnis-box nein" }, [h("h3", { text: "Code ungültig" }),
          h("p", { text: d ? "Dieser Code wurde nicht von Denkwerk erzeugt oder ist falsch abgetippt." : "Ein Prüfcode hat 20 Zeichen, zum Beispiel ABCDE-FGHJK-MNPQR-STVWX." })]));
        return;
      }
      var s = D.stufen[d.stufe];
      var abz = ABZEICHEN.filter(function (b, i) { return Math.floor(d.abz / Math.pow(2, i)) % 2 === 1; }).map(function (b) { return b.name; });
      var nameText;
      if (!d.name) nameText = "Die Urkunde wurde ohne Namen erstellt.";
      else if (!nameFeld.value.trim()) nameText = "Die Urkunde wurde mit Namen erstellt. Gib ihn oben ein, um ihn zu prüfen.";
      else nameText = nameHash(nameFeld.value) === d.name ? "Der Name passt zum Code." : "Der Name passt NICHT zum Code.";
      var nameOk = !d.name || !nameFeld.value.trim() || nameHash(nameFeld.value) === d.name;
      ausgabe.appendChild(h("div", { class: "ergebnis-box " + (nameOk ? "ok" : "nein") }, [
        h("h3", { text: nameOk ? "Code gültig – diese Angaben stehen auf der echten Urkunde:" : "Achtung: Der Name passt nicht" }),
        h("table", { class: "pruef-tabelle" }, [
          h("tr", {}, [h("th", { text: "Stufe" }), h("td", { text: s.name })]),
          h("tr", {}, [h("th", { text: "Rang" }), h("td", { text: d.rang ? d.rang + " von 10: " + RAENGE[d.rang - 1] + " (" + urkundenArt(d.rang).titel + ")" : "noch kein Rang (Erfolgsnachweis)" })]),
          h("tr", {}, [h("th", { text: "Richtig gelöst" }), h("td", { text: d.geloest + " Aufgaben" })]),
          h("tr", {}, [h("th", { text: "Medaillen" }), h("td", { text: d.silber + "× Silber, " + d.gold + "× Gold" })]),
          h("tr", {}, [h("th", { text: "Abzeichen" }), h("td", { text: abz.length ? abz.length + ": " + abz.join(", ") : "keine" })]),
          h("tr", {}, [h("th", { text: "Erstellt am" }), h("td", { text: datumKurz(tagDatum(d.tag)) })]),
          h("tr", {}, [h("th", { text: "Name" }), h("td", { text: nameText })]),
        ]),
        h("p", { class: "leise", text: "Vergleiche diese Angaben mit der Urkunde. Weichen sie ab, wurde die Urkunde verändert." }),
      ]));
      if (lkAngemeldet() && nameOk) ausgabe.appendChild(inKlasseBereich(codeFeld.value, nameFeld.value));
    }
    function inKlasseBereich(code, name) {
      var kd = klLaden();
      var nf = h("input", { class: "feld", id: "p-kl-name", type: "text", autocomplete: "off", spellcheck: "false", value: name || "", placeholder: "Vor- und Nachname" });
      var box = h("div", { class: "blatt stapel kl-uebernehmen" }, [h("h3", { text: "In die Klassenübersicht übernehmen" })]);
      if (!kd.klassen.length) {
        box.appendChild(h("p", { class: "leise", text: "Du hast noch keine Klasse angelegt." }));
        box.appendChild(h("div", { class: "knopfreihe" }, [h("button", { class: "knopf leicht", type: "button", onclick: function () { zeige("lkKlassen"); } }, ["Klassenübersicht öffnen"])]));
        return box;
      }
      var sel = auswahlFeld("p-kl-klasse", kd.klassen.map(function (k) { return [k.id, k.name]; }), kd.klassen[0].id);
      var meld = h("div", { "aria-live": "polite" });
      box.appendChild(h("div", { class: "antwortfeld" }, [h("label", { for: "p-kl-klasse", text: "Klasse" }), sel]));
      box.appendChild(h("div", { class: "antwortfeld" }, [h("label", { for: "p-kl-name", text: "Name" }), nf]));
      box.appendChild(h("div", { class: "knopfreihe" }, [h("button", { class: "knopf", type: "button", onclick: function () {
        var r = klEintragen(kd, sel.value, nf.value, code);
        meld.innerHTML = "";
        if (r.fehler) { meld.appendChild(h("div", { class: "ergebnis-box nein" }, [h("p", { text: r.fehler })])); return; }
        klSpeichern(kd);
        toast(nf.value.trim() + " " + r.hinweis);
        zeige("lkKlassen", { klasse: sel.value });
      } }, ["Übernehmen"])]));
      box.appendChild(meld);
      return box;
    }
    var form = h("form", { class: "blatt stapel", novalidate: true }, [
      h("div", { class: "antwortfeld" }, [h("label", { for: "p-code", text: "Prüfcode" }), codeFeld]),
      h("div", { class: "antwortfeld" }, [h("label", { for: "p-name", text: "Name auf der Urkunde (freiwillig)" }), nameFeld]),
      h("div", { class: "knopfreihe" }, [h("button", { class: "knopf", type: "submit" }, ["Prüfen"])]),
      ausgabe,
    ]);
    form.addEventListener("submit", function (e) { e.preventDefault(); pruefe(); });
    seite.appendChild(form);
    if (code) pruefe();
  };

  // ------------------------------------------------------------ Klassenübersicht (nur auf dem Gerät der Lehrkraft)
  // Die Lehrkraft trägt die Prüfcodes der Urkunden ein. Gespeichert wird lokal unter KL_KEY:
  // { klassen: [{ id, name, eintraege: [{ name, code, eingetragen }] }] }. Kein Server.
  var KL_KEY = "denkwerk.klassen.v1";
  function klLaden() {
    try { var d = JSON.parse(localStorage.getItem(KL_KEY) || "null"); if (d && Array.isArray(d.klassen)) return d; } catch (e) { /* leer */ }
    return { klassen: [] };
  }
  function klSpeichern(d) {
    try { localStorage.setItem(KL_KEY, JSON.stringify(d)); return true; }
    catch (e) { toast("Speichern hat nicht geklappt – der Browser erlaubt keinen Speicher"); return false; }
  }
  function klNeueId() { return "k" + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36); }
  // Trägt einen Code ein. Pro Name und Stufe bleibt nur die neueste/beste Urkunde stehen.
  function klEintragen(d, klasseId, name, code) {
    var k = d.klassen.filter(function (x) { return x.id === klasseId; })[0];
    if (!k) return { fehler: "Klasse nicht gefunden." };
    var info = codeLesen(code);
    if (!info || !info.gueltig) return { fehler: "Der Prüfcode ist ungültig oder falsch abgetippt." };
    name = String(name || "").trim().replace(/\s+/g, " ");
    if (!name) return { fehler: "Bitte gib den Namen ein." };
    if (info.name && nameHash(name) !== info.name) return { fehler: "Der Name passt nicht zum Code. Auf der Urkunde steht ein anderer Name (oder er ist anders geschrieben)." };
    var norm = codeBauen(info).replace(/-/g, "");   // einheitliche Schreibweise (O/0, I/1, Bindestriche)
    var doppelt = k.eintraege.filter(function (e) { return e.code === norm && nameNorm(e.name) !== nameNorm(name); })[0];
    if (doppelt) return { fehler: "Dieser Code ist schon für „" + doppelt.name + "“ eingetragen." };
    var alt = k.eintraege.filter(function (e) { var i = codeLesen(e.code); return nameNorm(e.name) === nameNorm(name) && i && i.stufe === info.stufe; })[0];
    var hinweis = "eingetragen";
    if (alt) {
      var ai = codeLesen(alt.code);
      if (ai.tag > info.tag || (ai.tag === info.tag && ai.geloest > info.geloest)) return { fehler: "Für " + name + " ist in dieser Stufe schon eine neuere Urkunde eingetragen." };
      k.eintraege.splice(k.eintraege.indexOf(alt), 1); hinweis = "aktualisiert"; name = alt.name;
    }
    k.eintraege.push({ name: name, code: norm, eingetragen: isoTag(new Date()) });
    return { ok: true, hinweis: hinweis, info: info };
  }
  function codeSchoen(c) { return String(c).replace(/(.{5})(?=.)/g, "$1-"); }
  function klZeilen(k) {
    return k.eintraege.map(function (e) { return { e: e, i: codeLesen(e.code) }; }).filter(function (z) { return z.i && z.i.gueltig; })
      .sort(function (a, b) { return a.e.name.localeCompare(b.e.name, "de") || a.i.stufe - b.i.stufe; });
  }
  function abzAnzahl(maske) { var n = 0; ABZEICHEN.forEach(function (b, i) { if (Math.floor(maske / Math.pow(2, i)) % 2 === 1) n++; }); return n; }
  function klCsv(k) {
    var kopfz = ["Name", "Stufe", "Rang", "Rangname", "Richtig gelöst", "Silber", "Gold", "Abzeichen", "Urkunde vom", "Prüfcode"];
    var zeilen = [kopfz].concat(klZeilen(k).map(function (z) {
      var i = z.i;
      return [z.e.name, D.stufen[i.stufe].name, i.rang, i.rang ? RAENGE[i.rang - 1] : "", i.geloest, i.silber, i.gold, abzAnzahl(i.abz), datumKurz(tagDatum(i.tag)), codeSchoen(z.e.code)];
    }));
    return "﻿" + zeilen.map(function (r) { return r.map(function (x) { x = String(x); return /[;"\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; }).join(";"); }).join("\r\n");
  }

  ANSICHTEN.lkKlassen = function (seite, arg) {
    if (!lkAngemeldet()) { zeige("lehrkraft"); return; }
    lkKopf(seite, true);
    var d = klLaden();
    arg = arg || {};
    var aktiv = d.klassen.filter(function (x) { return x.id === arg.klasse; })[0] || d.klassen[0] || null;
    seite.appendChild(h("section", { class: "begruessung" }, [
      h("span", { class: "label", text: "Lehrkraft-Bereich" }), h("h1", { text: "Klassenübersicht" }),
      h("p", { text: "Trage die Prüfcodes der Urkunden deiner Schülerinnen und Schüler ein. Die Liste bleibt nur auf diesem Gerät – es werden keine Daten verschickt." }),
    ]));

    // Klassenwahl
    var wahl = h("div", { class: "blatt stapel nicht-drucken" });
    seite.appendChild(wahl);
    var klName = h("input", { class: "feld", id: "kl-neu", type: "text", autocomplete: "off", placeholder: "z. B. 7b", maxlength: "30" });
    var neuForm = h("form", { class: "knopfreihe kl-neu", novalidate: true }, [klName, h("button", { class: "knopf leicht", type: "submit" }, ["Klasse anlegen"])]);
    neuForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var n = klName.value.trim();
      if (!n) { klName.focus(); return; }
      if (d.klassen.some(function (x) { return x.name.toLowerCase() === n.toLowerCase(); })) { toast("Diese Klasse gibt es schon"); return; }
      var k = { id: klNeueId(), name: n, eintraege: [] };
      d.klassen.push(k); klSpeichern(d); zeige("lkKlassen", { klasse: k.id });
    });
    if (d.klassen.length) {
      var reiter = h("div", { class: "kl-reiter", role: "tablist", "aria-label": "Klassen" });
      d.klassen.forEach(function (k) {
        reiter.appendChild(h("button", { class: "chip kl-chip" + (k === aktiv ? " aktiv" : ""), type: "button", role: "tab", "aria-selected": k === aktiv ? "true" : "false",
          onclick: function () { zeige("lkKlassen", { klasse: k.id }); } }, [k.name + " (" + k.eintraege.length + ")"]));
      });
      wahl.appendChild(h("label", { class: "label", text: "Klasse" }));
      wahl.appendChild(reiter);
    }
    wahl.appendChild(h("label", { class: "label", for: "kl-neu", text: d.klassen.length ? "Weitere Klasse anlegen" : "Lege zuerst eine Klasse an" }));
    wahl.appendChild(neuForm);
    if (!aktiv) return;

    // Eintragen
    var codeFeld = h("input", { class: "feld code", id: "kl-code", type: "text", autocomplete: "off", autocapitalize: "characters", spellcheck: "false", placeholder: "XXXXX-XXXXX-XXXXX-XXXXX", value: arg.code || "" });
    var nameFeld = h("input", { class: "feld", id: "kl-name", type: "text", autocomplete: "off", spellcheck: "false", placeholder: "Vor- und Nachname", value: arg.name || "" });
    var meldung = h("div", { "aria-live": "polite" });
    var eintragForm = h("form", { class: "blatt stapel nicht-drucken", novalidate: true }, [
      h("h2", { text: "Urkunde eintragen – " + aktiv.name }),
      h("div", { class: "antwortfeld" }, [h("label", { for: "kl-name", text: "Name" }), nameFeld]),
      h("div", { class: "antwortfeld" }, [h("label", { for: "kl-code", text: "Prüfcode von der Urkunde" }), codeFeld]),
      h("p", { class: "leise", style: "font-size:.88rem", text: "Tipp: Scanne den QR-Code der Urkunde mit der Kamera-App. Denkwerk öffnet dann „Urkunde prüfen“, und dort kannst du die Urkunde direkt in eine Klasse übernehmen." }),
      h("div", { class: "knopfreihe" }, [h("button", { class: "knopf", type: "submit" }, ["Eintragen"])]),
      meldung,
    ]);
    eintragForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var r = klEintragen(d, aktiv.id, nameFeld.value, codeFeld.value);
      meldung.innerHTML = "";
      if (r.fehler) { meldung.appendChild(h("div", { class: "ergebnis-box nein" }, [h("p", { text: r.fehler })])); return; }
      klSpeichern(d);
      toast(nameFeld.value.trim() + " " + r.hinweis);
      zeige("lkKlassen", { klasse: aktiv.id });
      setTimeout(function () { var f = document.getElementById("kl-name"); if (f) f.focus(); }, 30);
    });
    seite.appendChild(eintragForm);

    // Tabelle
    var zeilen = klZeilen(aktiv);
    var tab = h("section", { class: "blatt stapel" });
    seite.appendChild(tab);
    tab.appendChild(h("h2", { text: aktiv.name + ": " + zeilen.length + (zeilen.length === 1 ? " Urkunde" : " Urkunden") }));
    if (!zeilen.length) {
      tab.appendChild(h("p", { class: "leise", text: "Noch keine Einträge." }));
    } else {
      var proStufe = {};
      zeilen.forEach(function (z) { var s = D.stufen[z.i.stufe].name; (proStufe[s] = proStufe[s] || []).push(z.i); });
      tab.appendChild(h("div", { class: "kl-kennzahlen" }, Object.keys(proStufe).map(function (s) {
        var l = proStufe[s], schnitt = l.reduce(function (x, i) { return x + i.rang; }, 0) / l.length;
        return h("div", { class: "kl-kennzahl" }, [h("span", { class: "label", text: s }),
          h("strong", { text: String(Math.round(schnitt * 10) / 10).replace(".", ",") }), h("span", { class: "leise", text: "Ø Rang bei " + l.length + (l.length === 1 ? " Urkunde" : " Urkunden") })]);
      })));
      var tbody = h("tbody");
      zeilen.forEach(function (z) {
        var i = z.i;
        tbody.appendChild(h("tr", {}, [
          h("th", { scope: "row", text: z.e.name }),
          h("td", { text: D.stufen[i.stufe].name }),
          h("td", { class: "zahl", text: i.rang ? i.rang + " · " + RAENGE[i.rang - 1] : "–" }),
          h("td", { class: "zahl", text: String(i.geloest) }),
          h("td", { class: "zahl", text: i.silber + " / " + i.gold }),
          h("td", { class: "zahl", text: String(abzAnzahl(i.abz)) }),
          h("td", { text: datumKurz(tagDatum(i.tag)) }),
          h("td", { class: "nicht-drucken" }, [h("button", { class: "kl-weg", type: "button", "aria-label": z.e.name + " entfernen", title: "Eintrag entfernen", onclick: function () {
            dialog("Eintrag entfernen?", "<strong>" + z.e.name.replace(/</g, "&lt;") + "</strong> (" + D.stufen[i.stufe].name + ") wird aus der Liste gelöscht.", [
              { text: "Entfernen", art: "warn", aktion: function () { aktiv.eintraege.splice(aktiv.eintraege.indexOf(z.e), 1); klSpeichern(d); zeige("lkKlassen", { klasse: aktiv.id }); } },
              { text: "Abbrechen", art: "zweit" },
            ]);
          } }, ["✕"])]),
        ]));
      });
      tab.appendChild(h("div", { class: "kl-tabelle-rahmen" }, [h("table", { class: "kl-tabelle" }, [
        h("thead", {}, [h("tr", {}, ["Name", "Stufe", "Rang", "Gelöst", "Silber / Gold", "Abzeichen", "Urkunde vom", ""].map(function (t) { return h("th", { scope: "col", text: t }); }))]),
        tbody,
      ])]));
    }
    // Werkzeuge
    var datei = h("input", { type: "file", accept: ".json,application/json", hidden: true, "aria-hidden": "true" });
    datei.addEventListener("change", function () {
      var f = datei.files && datei.files[0]; datei.value = "";
      if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        var neu = 0, fehl = 0;
        try {
          var inhalt = JSON.parse(r.result);
          if (!inhalt || inhalt.art !== "denkwerk-klassen" || !Array.isArray(inhalt.klassen)) throw new Error("falsch");
          inhalt.klassen.forEach(function (kk) {
            var ziel = d.klassen.filter(function (x) { return x.name.toLowerCase() === String(kk.name).toLowerCase(); })[0];
            if (!ziel) { ziel = { id: klNeueId(), name: String(kk.name).slice(0, 30), eintraege: [] }; d.klassen.push(ziel); }
            (kk.eintraege || []).forEach(function (e) {
              var vorher = ziel.eintraege.some(function (x) { return x.code === e.code && nameNorm(x.name) === nameNorm(e.name); });
              if (vorher) return;
              var res = klEintragen(d, ziel.id, e.name, e.code);
              if (res.ok) neu++; else fehl++;
            });
          });
        } catch (err) { toast("Diese Datei ist keine Klassenliste von Denkwerk"); return; }
        klSpeichern(d);
        toast(neu + " Einträge übernommen" + (fehl ? ", " + fehl + " übersprungen" : ""));
        zeige("lkKlassen", { klasse: aktiv.id });
      };
      r.readAsText(f);
    });
    seite.appendChild(h("section", { class: "blatt stapel nicht-drucken" }, [
      h("h2", { text: "Liste sichern und weitergeben" }),
      h("p", { class: "leise", text: "Die Klassenliste liegt nur in diesem Browser. Speichere ab und zu eine Sicherung. Die Tabelle für Excel oder Numbers enthält Namen – gib sie nur auf sicherem Weg weiter." }),
      h("div", { class: "knopfreihe" }, [
        h("button", { class: "knopf leicht", type: "button", onclick: function () {
          dateiAnbieten(new Blob([klCsv(aktiv)], { type: "text/csv;charset=utf-8" }), "Denkwerk-" + aktiv.name.replace(/[^\w\-]+/g, "_") + "-" + isoTag(new Date()) + ".csv", "Denkwerk " + aktiv.name);
        } }, ["Tabelle (CSV) für Excel"]),
        h("button", { class: "knopf leicht", type: "button", onclick: function () { window.print(); } }, ["Drucken"]),
        h("button", { class: "knopf zweit", type: "button", onclick: function () {
          var inhalt = { art: "denkwerk-klassen", version: 1, erstellt: new Date().toISOString(), klassen: d.klassen };
          dateiAnbieten(new Blob([JSON.stringify(inhalt, null, 1)], { type: "application/json" }), "Denkwerk-Klassen-" + isoTag(new Date()) + ".json", "Denkwerk Klassen");
        } }, ["Alle Klassen sichern"]),
        h("button", { class: "knopf zweit", type: "button", onclick: function () { datei.click(); } }, ["Sicherung laden"]),
      ]),
      datei,
      h("div", { class: "knopfreihe abstand" }, [
        h("button", { class: "knopf zweit warn-text", type: "button", onclick: function () {
          dialog("Klasse " + aktiv.name.replace(/</g, "&lt;") + " löschen?", "Die Klasse und alle " + aktiv.eintraege.length + " Einträge werden von diesem Gerät gelöscht.", [
            { text: "Löschen", art: "warn", aktion: function () { d.klassen.splice(d.klassen.indexOf(aktiv), 1); klSpeichern(d); zeige("lkKlassen"); } },
            { text: "Abbrechen", art: "zweit" },
          ]);
        } }, ["Klasse löschen"]),
      ]),
    ]));
  };

  // Links mit #auftrag=… oder #pruefen=… auswerten
  function hashAuswerten() {
    var hs = location.hash || "", m, ziel = null;
    if ((m = hs.match(/^#auftrag=([0-9A-Za-z-]+)/))) {
      var a = auftragLesen(m[1]);
      if (a) { auftragUebernehmen(a); ziel = { auftrag: a }; }
    } else if ((m = hs.match(/^#pruefen=([0-9A-Za-z-]+)/))) {
      ziel = { pruefen: m[1] };
    } else if (hs === "#lehrkraft") {
      ziel = { lehrkraft: true };
    }
    if (hs && history.replaceState) history.replaceState(null, "", location.pathname + location.search);
    return ziel;
  }

  // ------------------------------------------------------------ Start
  laden();
  abzeichenAktualisieren(false);
  window.__denkwerkZeige = zeige;   // für automatische Tests
  window.__denkwerkIntern = { zustand: function () { return zustand; }, codeLesen: codeLesen, codeBauen: codeBauen, nameHash: nameHash, auftragLesen: auftragLesen, auftragCode: auftragCode,
    urkundeDaten: urkundeDaten, urkundePdf: urkundePdf, sicherungInhalt: sicherungInhalt, siegel: siegel, statistik: statistik, laden: laden };
  var startZiel = hashAuswerten();
  if (startZiel && startZiel.pruefen) zeige("pruefen", startZiel.pruefen);
  else if (startZiel && startZiel.lehrkraft) zeige("lehrkraft");
  else if (zustand.auth) { zeige("start"); if (startZiel && startZiel.auftrag) toast("Neuer Auftrag von deiner Lehrkraft"); }
  else zeige("anmeldung");
  // Link wird geöffnet, während Denkwerk schon offen ist (nur der Teil nach # ändert sich)
  window.addEventListener("hashchange", function () {
    var z = hashAuswerten();
    if (!z) return;
    if (z.pruefen) zeige("pruefen", z.pruefen);
    else if (z.lehrkraft) zeige("lehrkraft");
    else if (z.auftrag) { if (zustand.auth) { zeige("start"); toast("Neuer Auftrag von deiner Lehrkraft"); } else zeige("anmeldung"); }
  });
})();
