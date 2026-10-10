/**
 * de — Deutsch.
 *
 * 번역자에게:
 *  - 키는 동결이다. 추가/삭제/이름변경 금지 (하면 컴파일 에러가 난다).
 *  - {likeThis} 자리표시자는 철자 그대로 유지하고, en 에 있는 것은 전부 남긴다.
 *  - 값 안에 HTML 태그를 넣지 않는다.
 *
 * 이름 풀(64+64)은 8x8 격자를 그대로 유지한다(idx = i*8 + j).
 *  nick: Flink/Still/Blau/Klein/Tief/Klar/Rund/Fest
 *        x Schauer/Löwenzahn/Elster/Abendrot/Bleistift/Kranich/Windrad/Knopf
 *        — 형용사는 강변화 1격으로 성에 맞춘다 (m -er / f -e / n -es).
 *  bot:  Emsig/Kühl/Lässig/Zäh/Leise/Kühn/Genau/Wach
 *        x Makler/Gutsherr/Vermesser/Siedler/Baumeister/Anleger/Händler/Landkönig
 *        — 명사 8종이 전부 남성이라 어미는 전부 -er.
 */
import type { Messages } from '../types';

const de: Messages = {
  // brand.name = document.title 전용(9개 언어 모두 영문 브랜드 고정).
  // game.title = 인게임 표시용(현지화 대상). 둘을 다시 합치지 마라 — en.ts 주석 참고.
  'brand.name': 'Territory Clash',
  'game.title': 'Territory Clash',

  'splash.subtitle': '{cols} × {rows}, {players} Spieler, {seconds} Sek.',

  // 시작 메뉴(모드·난이도). menu.mode.* / menu.difficulty.* 는 코드가 키를 조립한다.

  'menu.subtitle': 'Spieldauer und Schwierigkeit wählen',

  // Duell des Tages (Teilnahme) — ★neu 2026-08-22. Sieg/Niederlage egal; zählt ist der Abschluss (phase='over' erreicht).
  'menu.dailyClash.title': 'Duell des Tages',
  'menu.dailyClash.status.pending': 'Heute spielen für {streak} Tage in Folge · +{coins} Münzen bei Abschluss',
  'menu.dailyClash.status.done': 'Heute erledigt! {streak} Tage in Folge · bis morgen',
  'menu.dailyClash.play': 'Duell des Tages spielen',
  'menu.dailyClash.doneButton': 'Erledigt',

  'menu.mode': 'SPIELDAUER',

  'menu.mode.60': '1 Min.',

  'menu.mode.180': '3 Min.',

  'menu.mode.300': '5 Min.',

  'menu.mode.desc': 'Karte {cols} × {rows} · {players} Spieler',

  'menu.difficulty': 'SCHWIERIGKEIT',

  'menu.difficulty.auto': 'Auto',

  'menu.difficulty.easy': 'Leicht',

  'menu.difficulty.normal': 'Normal',

  'menu.difficulty.hard': 'Schwer',

  'menu.difficulty.elite': 'Elite',

  'menu.difficulty.auto.hint': 'Der Schwierigkeitsgrad passt sich automatisch deinen letzten Ergebnissen an.', // ★2026-08-22 T5: "Bots" 표기 제거

  'menu.best': 'Bestwert in diesem Modus',

  'menu.best.none': '0', // ★2026-08-22 AI-tea T1: em-dash(값처럼 보이는 기호) 금지 -> 실제 빈 상태 값 0 (fmt(0)과 동일 표기, neon-thread 승인 전례)

  'menu.start': 'Starten',


  'hud.rank.unit': 'PLATZ',
  'hud.time.unit': 'SEK',

  // 3·5분 모드는 시간 칩이 m:ss 라 단위 라벨이 다르다.

  'hud.time.unit.long': 'ZEIT',
  'hud.rate': '+{rate}/s',
  'hud.bounce': 'Abprall',
  'hud.bounce.aria': 'Dreifacher Abprall',

  'modal.pause.title': 'Pause',
  'modal.pause.body':
    'Das Spiel ist angehalten. Drücke noch einmal Zurück, dann kannst du das Spiel beenden.',
  'modal.pause.resume': 'Weiter',
  'modal.revive.title': 'Dein ganzes Gebiet ist weg',
  'modal.revive.body':
    'Du kannst auf freiem Land mit einem {size}-Feld neu starten. Nur {limit} pro Runde.',
  'modal.revive.limit': 'einmal',
  'modal.revive.decline': 'Ergebnis',
  'modal.revive.accept': 'Wiederbeleben',
  'modal.revive.body.free': 'Du kannst auf freiem Land mit einem {size}-Feld neu starten. Kostenlos {limit} pro Runde.',
  'modal.revive.body.ad': 'Sieh dir eine kurze Werbung an, um noch einmal zurückzukommen.',
  'modal.revive.accept.ad': 'Werbung ansehen',
  'modal.revive.loading': 'Werbung wird geladen…',
  'modal.exit.title': 'Spiel beenden?',
  'modal.exit.body': 'Dein laufendes Spiel wird nicht gespeichert.',
  'modal.exit.confirm': 'Beenden',
  'modal.exit.cancel': 'Weiter',

  'result.newBest': 'Neuer Rekord!',
  'result.cells': 'Gesamtgebiet',
  'result.income': 'Bodenertrag',
  'result.kills': 'Ausschaltungen',
  'result.maxTrail': 'Längste Spur',
  'result.coins': 'Münzen',
  'result.xp': 'EP',
  'result.restart': 'Nochmal',

  'result.changeMode': 'Modus wechseln',

  'result.mode': '{mode} · {players} Spieler',
  'result.value.cells': '{percent}%',
  'result.value.kills': '{count}',
  'result.value.trail': '{count} Felder',
  'result.value.coins': '+{count}',
  'result.value.xp': '+{count}',

  'career.title': 'Bilanz',
  'career.plays': 'Gespielte Runden',
  'career.wins': 'Erste Plätze',
  'career.kills': 'Ausschaltungen gesamt',
  'career.xp': 'EP gesamt',
  'career.value.plays': '{count}',
  'career.value.wins': '{count}',
  'career.value.kills': '{count}',
  'career.value.xp': '{count}',

  'fx.kill': 'Erledigt!',

  'tier.normal': 'Normal',
  'tier.commercial': 'Gewerbe',
  'tier.special': 'Spezial',
  'tier.label': '{name} ({value}/s)',

  'unit.you': 'Du',
  'unit.ghost': '{nick} von gestern',

  'error.fatal.title': 'Etwas ist schiefgelaufen',
  'error.noCanvas': 'Das Spiel konnte nicht gestartet werden (Canvas-Element fehlt).',
  'error.sdkInit': 'Die SDK-Initialisierung ist fehlgeschlagen.',
  'error.gameStart': 'Das Spiel konnte nicht gestartet werden.',

  'settings.language': 'Sprache',
  'settings.privacyLink': 'Datenschutzerklärung',
  'settings.sound': 'Ton',
  'settings.sound.on': 'An',
  'settings.sound.off': 'Aus',

  // ── Toss-Push (Duell des Tages) — ★2026-09-10. Nur innerhalb von Toss gezeichnet (src/ui/pushOptIn.ts).
  'push.row.label': 'Hinweis zum Duell des Tages',
  'push.row.get': 'Aktivieren',
  'push.row.busy': 'Wird geprüft',
  'push.row.on': 'Aktiv',
  'push.row.retry': 'Erneut aktivieren',
  'push.row.hint': 'Wir melden uns täglich um 19 Uhr (KST), wenn die neue Karte des Duells des Tages öffnet. Abschalten kannst du es in den Benachrichtigungseinstellungen der Toss-App.',
  'push.row.error': 'Die Benachrichtigungseinstellungen konnten nicht geöffnet werden. Aktualisiere die Toss-App auf die neueste Version und tippe erneut.',
  'push.nudge.title': 'Hinweise zum Duell des Tages erhalten',
  'push.nudge.sub': 'Täglich um 19 Uhr (KST), wenn die neue Karte öffnet',
  'push.nudge.cta': 'Aktivieren',
  'push.nudge.busy': 'Wird geprüft',
  'push.nudge.close': 'Hinweis schließen',

  // ── Empfehlungskarte «Money League» (Ergebnisbildschirm, 1× pro Tag) — ★2026-09-10 (src/ui/crossPromo.ts).
  'promo.ml.label': 'Empfehlung',
  'promo.ml.title': 'Money League',
  'promo.ml.sub': 'Virtuell investieren in einer Liga mit 10.000 Bots',
  'promo.ml.open': 'Öffnen',
  'promo.ml.close': 'Empfehlung schließen',
  'promo.ml.fail': 'Konnte gerade nicht geöffnet werden. Suche in der Toss-App nach Money League.',

  'nick.name.0': 'Flinker Schauer',
  'nick.name.1': 'Flinker Löwenzahn',
  'nick.name.2': 'Flinke Elster',
  'nick.name.3': 'Flinkes Abendrot',
  'nick.name.4': 'Flinker Bleistift',
  'nick.name.5': 'Flinker Kranich',
  'nick.name.6': 'Flinkes Windrad',
  'nick.name.7': 'Flinker Knopf',
  'nick.name.8': 'Stiller Schauer',
  'nick.name.9': 'Stiller Löwenzahn',
  'nick.name.10': 'Stille Elster',
  'nick.name.11': 'Stilles Abendrot',
  'nick.name.12': 'Stiller Bleistift',
  'nick.name.13': 'Stiller Kranich',
  'nick.name.14': 'Stilles Windrad',
  'nick.name.15': 'Stiller Knopf',
  'nick.name.16': 'Blauer Schauer',
  'nick.name.17': 'Blauer Löwenzahn',
  'nick.name.18': 'Blaue Elster',
  'nick.name.19': 'Blaues Abendrot',
  'nick.name.20': 'Blauer Bleistift',
  'nick.name.21': 'Blauer Kranich',
  'nick.name.22': 'Blaues Windrad',
  'nick.name.23': 'Blauer Knopf',
  'nick.name.24': 'Kleiner Schauer',
  'nick.name.25': 'Kleiner Löwenzahn',
  'nick.name.26': 'Kleine Elster',
  'nick.name.27': 'Kleines Abendrot',
  'nick.name.28': 'Kleiner Bleistift',
  'nick.name.29': 'Kleiner Kranich',
  'nick.name.30': 'Kleines Windrad',
  'nick.name.31': 'Kleiner Knopf',
  'nick.name.32': 'Tiefer Schauer',
  'nick.name.33': 'Tiefer Löwenzahn',
  'nick.name.34': 'Tiefe Elster',
  'nick.name.35': 'Tiefes Abendrot',
  'nick.name.36': 'Tiefer Bleistift',
  'nick.name.37': 'Tiefer Kranich',
  'nick.name.38': 'Tiefes Windrad',
  'nick.name.39': 'Tiefer Knopf',
  'nick.name.40': 'Klarer Schauer',
  'nick.name.41': 'Klarer Löwenzahn',
  'nick.name.42': 'Klare Elster',
  'nick.name.43': 'Klares Abendrot',
  'nick.name.44': 'Klarer Bleistift',
  'nick.name.45': 'Klarer Kranich',
  'nick.name.46': 'Klares Windrad',
  'nick.name.47': 'Klarer Knopf',
  'nick.name.48': 'Runder Schauer',
  'nick.name.49': 'Runder Löwenzahn',
  'nick.name.50': 'Runde Elster',
  'nick.name.51': 'Rundes Abendrot',
  'nick.name.52': 'Runder Bleistift',
  'nick.name.53': 'Runder Kranich',
  'nick.name.54': 'Rundes Windrad',
  'nick.name.55': 'Runder Knopf',
  'nick.name.56': 'Fester Schauer',
  'nick.name.57': 'Fester Löwenzahn',
  'nick.name.58': 'Feste Elster',
  'nick.name.59': 'Festes Abendrot',
  'nick.name.60': 'Fester Bleistift',
  'nick.name.61': 'Fester Kranich',
  'nick.name.62': 'Festes Windrad',
  'nick.name.63': 'Fester Knopf',

  'bot.name.0': 'Emsiger Makler',
  'bot.name.1': 'Emsiger Gutsherr',
  'bot.name.2': 'Emsiger Vermesser',
  'bot.name.3': 'Emsiger Siedler',
  'bot.name.4': 'Emsiger Baumeister',
  'bot.name.5': 'Emsiger Anleger',
  'bot.name.6': 'Emsiger Händler',
  'bot.name.7': 'Emsiger Landkönig',
  'bot.name.8': 'Kühler Makler',
  'bot.name.9': 'Kühler Gutsherr',
  'bot.name.10': 'Kühler Vermesser',
  'bot.name.11': 'Kühler Siedler',
  'bot.name.12': 'Kühler Baumeister',
  'bot.name.13': 'Kühler Anleger',
  'bot.name.14': 'Kühler Händler',
  'bot.name.15': 'Kühler Landkönig',
  'bot.name.16': 'Lässiger Makler',
  'bot.name.17': 'Lässiger Gutsherr',
  'bot.name.18': 'Lässiger Vermesser',
  'bot.name.19': 'Lässiger Siedler',
  'bot.name.20': 'Lässiger Baumeister',
  'bot.name.21': 'Lässiger Anleger',
  'bot.name.22': 'Lässiger Händler',
  'bot.name.23': 'Lässiger Landkönig',
  'bot.name.24': 'Zäher Makler',
  'bot.name.25': 'Zäher Gutsherr',
  'bot.name.26': 'Zäher Vermesser',
  'bot.name.27': 'Zäher Siedler',
  'bot.name.28': 'Zäher Baumeister',
  'bot.name.29': 'Zäher Anleger',
  'bot.name.30': 'Zäher Händler',
  'bot.name.31': 'Zäher Landkönig',
  'bot.name.32': 'Leiser Makler',
  'bot.name.33': 'Leiser Gutsherr',
  'bot.name.34': 'Leiser Vermesser',
  'bot.name.35': 'Leiser Siedler',
  'bot.name.36': 'Leiser Baumeister',
  'bot.name.37': 'Leiser Anleger',
  'bot.name.38': 'Leiser Händler',
  'bot.name.39': 'Leiser Landkönig',
  'bot.name.40': 'Kühner Makler',
  'bot.name.41': 'Kühner Gutsherr',
  'bot.name.42': 'Kühner Vermesser',
  'bot.name.43': 'Kühner Siedler',
  'bot.name.44': 'Kühner Baumeister',
  'bot.name.45': 'Kühner Anleger',
  'bot.name.46': 'Kühner Händler',
  'bot.name.47': 'Kühner Landkönig',
  'bot.name.48': 'Genauer Makler',
  'bot.name.49': 'Genauer Gutsherr',
  'bot.name.50': 'Genauer Vermesser',
  'bot.name.51': 'Genauer Siedler',
  'bot.name.52': 'Genauer Baumeister',
  'bot.name.53': 'Genauer Anleger',
  'bot.name.54': 'Genauer Händler',
  'bot.name.55': 'Genauer Landkönig',
  'bot.name.56': 'Wacher Makler',
  'bot.name.57': 'Wacher Gutsherr',
  'bot.name.58': 'Wacher Vermesser',
  'bot.name.59': 'Wacher Siedler',
  'bot.name.60': 'Wacher Baumeister',
  'bot.name.61': 'Wacher Anleger',
  'bot.name.62': 'Wacher Händler',
  'bot.name.63': 'Wacher Landkönig',
};

export default de;
