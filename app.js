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
  var zustand = { auth: false, stufe: null, aufgaben: {}, hinweisWeg: false };
  function laden() {
    try {
      var raw = window.localStorage.getItem(SPEICHER_KEY);
      if (raw) {
        var z = JSON.parse(raw);
        if (z && typeof z === "object") zustand = Object.assign(zustand, z);
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

  function aufgabenVon(stufe, kat) {
    return D.aufgaben.filter(function (a) { return a.stufe === stufe && (!kat || a.kat === kat); });
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
      '<path d="M9 22 L16 9 L23 22 M12 17.5 H20" stroke="var(--flaeche)" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
      '<span>Denkwerk</span>' });
  }

  function kopf(zurueck) {
    var k = h("header", { class: "kopf" }, [logo()]);
    var gruppe = h("div", { class: "kopf-knoepfe" });
    if (zurueck) gruppe.appendChild(h("button", { class: "zurueck", type: "button", onclick: zurueck.aktion }, ["← " + zurueck.text]));
    k.appendChild(gruppe);
    k.gruppe = gruppe;
    return k;
  }

  function zeige(ansicht, arg) {
    aktuelleAnsicht = { name: ansicht, arg: arg };
    app.innerHTML = "";
    var seite = h("main", { class: "seite" });
    app.appendChild(seite);
    ANSICHTEN[ansicht](seite, arg);
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
    ]));
    setTimeout(function () { eingabe.focus(); }, 50);
  };

  function fortschritt(stufe) {
    var alle = aufgabenVon(stufe);
    var fertig = alle.filter(function (a) { return status(a.id) === "erledigt"; }).length;
    return { fertig: fertig, alle: alle.length };
  }

  ANSICHTEN.start = function (seite) {
    seite.appendChild(kopf(null));
    var begonnen = Object.keys(zustand.aufgaben).filter(function (id) { return aufgabeNachId[id]; }).length;
    seite.appendChild(h("section", { class: "begruessung" }, [
      h("h1", { text: "Welche Stufe bist du?" }),
      h("p", { text: "Wähle deine Jahrgangsstufe. Dort findest du Knobelaufgaben, die zu dem passen, was du schon kannst. Du darfst auch eine Stufe höher probieren." }),
    ]));
    var raster = h("div", { class: "stufen" });
    D.stufen.forEach(function (s) {
      var f = fortschritt(s.id);
      raster.appendChild(h("button", { class: "stufe", type: "button", onclick: function () {
        zustand.stufe = s.id; sichern(); zeige("stufe", s.id);
      } }, [
        h("span", { class: "gross", text: s.kurz }),
        h("span", { class: "klein", text: s.name }),
        h("span", { class: "klein stand", text: f.fertig + " von " + f.alle + " erledigt" }),
        h("span", { class: "balken", "aria-hidden": "true" }, [h("span", { style: "width:" + (f.alle ? (100 * f.fertig / f.alle) : 0) + "%" })]),
      ]));
    });
    seite.appendChild(raster);

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

    seite.appendChild(h("footer", { class: "fuss" }, [
      h("p", { text: "Dein Fortschritt wird nur auf diesem Gerät gespeichert. Niemand sonst kann ihn sehen." }),
      h("button", { type: "button", onclick: function () {
        dialog("Alles zurücksetzen?", "Damit löschst du alle gespeicherten Aufgaben und Ergebnisse auf diesem Gerät. Das lässt sich nicht rückgängig machen.", [
          { text: "Ja, alles löschen", art: "warn", aktion: function () {
            zustand.aufgaben = {}; sichern(); toast("Fortschritt gelöscht"); zeige("start");
          } },
          { text: "Abbrechen", art: "zweit" },
        ]);
      } }, ["Fortschritt auf diesem Gerät löschen"]),
    ]));
  };

  ANSICHTEN.stufe = function (seite, stufe) {
    var s = stufeNachId[stufe];
    seite.appendChild(kopf({ text: "Hauptmenü", aktion: function () { zeige("start"); } }));
    var f = fortschritt(stufe);
    seite.appendChild(h("section", { class: "begruessung" }, [
      h("span", { class: "label", text: s.name }),
      h("h1", { text: "Such dir eine Kategorie aus" }),
      h("p", { text: f.fertig + " von " + f.alle + " Aufgaben erledigt. Oder lass das Glücksrad entscheiden." }),
    ]));
    seite.appendChild(h("div", { class: "knopfreihe" }, [
      h("button", { class: "knopf", type: "button", onclick: function () { zeige("rad", stufe); } }, ["Glücksrad drehen"]),
      h("button", { class: "knopf zweit", type: "button", onclick: function () { zeige("letzte"); } }, ["Letzte Aufgaben"]),
    ]));
    var liste = h("div", { class: "liste abschnitt" });
    kategorienVon(stufe).forEach(function (k) {
      var auf = aufgabenVon(stufe, k.id);
      var fertig = auf.filter(function (a) { return status(a.id) === "erledigt"; }).length;
      var angefangen = auf.filter(function (a) { return status(a.id) === "begonnen"; }).length;
      var klasse = "eintrag" + (fertig === auf.length ? " erledigt" : (angefangen ? " begonnen" : ""));
      liste.appendChild(h("button", { class: klasse, type: "button", onclick: function () { zeige("kategorie", { stufe: stufe, kat: k.id }); } }, [
        h("span", { class: "sym", "aria-hidden": "true", text: k.symbol }),
        h("span", { class: "mitte" }, [
          h("span", { class: "titel", text: k.name }),
          h("span", { class: "unter", text: k.kurz }),
        ]),
        h("span", { class: "stand", text: fertig + "/" + auf.length }),
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
    seite.appendChild(kopf({ text: "Kategorien", aktion: function () { zeige("stufe", arg.stufe); } }));
    seite.appendChild(h("section", { class: "begruessung" }, [
      h("span", { class: "label", text: stufeNachId[arg.stufe].name }),
      h("h1", { text: k.name }),
      h("p", { text: k.beschreibung }),
    ]));
    var liste = h("div", { class: "liste" });
    aufgabenVon(arg.stufe, arg.kat).forEach(function (a) { liste.appendChild(aufgabeEintrag(a, false)); });
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
    seite.appendChild(kopf({ text: "Kategorien", aktion: function () { zeige("stufe", stufe); } }));
    seite.appendChild(h("section", { class: "begruessung" }, [
      h("span", { class: "label", text: stufeNachId[stufe].name }),
      h("h1", { text: "Glücksrad" }),
      h("p", { text: "Das Rad lost dir eine Aufgabe aus allen Kategorien zu. Erledigte Aufgaben sind nicht mehr dabei." }),
    ]));
    var offen = aufgabenVon(stufe).filter(function (a) { return status(a.id) !== "erledigt"; });
    if (!offen.length) {
      seite.appendChild(h("div", { class: "blatt stapel" }, [
        h("h2", { text: "Alles geschafft!" }),
        h("p", { text: "Du hast alle Aufgaben dieser Stufe erledigt. Probier doch die nächste Stufe aus." }),
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

    var k1 = kopf({ text: "Hauptmenü", aktion: function () { verlassen(function () { zeige("start"); }); } });
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
    if (gespeichert && gespeichert.zuletzt) meta.appendChild(h("span", { class: "chip " + gespeichert.status, text: "zuletzt: " + datumText(gespeichert.zuletzt) }));
    blatt.appendChild(h("header", { class: "aufgabe-kopf" }, [meta, h("h1", { text: a.titel }),
      h("p", { class: "leise", style: "font-size:.85rem", text: "Kompetenz: " + a.kompetenz })]));
    blatt.appendChild(h("div", { class: "aufgabentext", html: a.text }));

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
          { text: "Ja, Lösung zeigen", aktion: function () { arbeit.hilfen = 3; hilfenZeigen(); } },
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
      sichern();
      erledigt = true;
      typ.sperren(ui);
      pruefKnopf.hidden = true; speicherKnopf.hidden = true; resetKnopf.hidden = false;
      hilfenZeigen();
      auswertungZeigen(erg);
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
      dialog("Aufgabe neu starten?", "Deine Eingaben und das Ergebnis dieser Aufgabe werden gelöscht.", [
        { text: "Neu starten", art: "warn", aktion: function () { delete zustand.aufgaben[id]; sichern(); zeige("aufgabe", id); } },
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

  // ------------------------------------------------------------ Start
  laden();
  window.__denkwerkZeige = zeige;   // für automatische Tests
  if (zustand.auth) zeige("start"); else zeige("anmeldung");
})();
