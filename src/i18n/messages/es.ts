/**
 * es — español.
 *
 * 규칙
 *  - 키는 동결이다. 추가/삭제/이름변경 금지 (하면 컴파일 에러가 난다).
 *  - {likeThis} 자리표시자는 철자 그대로 유지한다(어순 재배치는 허용).
 *  - 값 안에 HTML 태그를 넣지 않는다.
 *
 * 번역 노트
 *  - nick.name.*  : 8 형용사 × 8 자연 명사. 명사 뒤에 형용사를 두고 성수 일치.
 *                   Chaparrón(m)·Diente de León(m)·Urraca(f)·Ocaso(m)·
 *                   Lápiz(m)·Grulla(f)·Molinillo(m)·Botón(m)
 *  - bot.name.*   : 8 형용사 × 8 부동산 직함. 동일 규칙.
 *                   Inmobiliaria(f)·Terrateniente(m)·Topógrafo(m)·Pionero(m)·
 *                   Arquitecto(m)·Inversor(m)·Corredor(m)·Rey de la Tierra(m)
 */
import type { Messages } from '../types';

const es: Messages = {
  // brand.name = document.title 전용(9개 언어 모두 영문 브랜드 고정).
  // game.title = 인게임 표시용(현지화 대상). 둘을 다시 합치지 마라 — en.ts 주석 참고.
  'brand.name': 'Territory Clash',
  'game.title': 'Territory Clash',

  'splash.subtitle': '{cols} × {rows}, {players} jugadores, {seconds} s',

  // 시작 메뉴(모드·난이도). menu.mode.* / menu.difficulty.* 는 코드가 키를 조립한다.

  'menu.subtitle': 'Elige la duración y la dificultad',

  // Duelo del día (asistencia) — ★nuevo 2026-08-22. No importa ganar o perder; importa completar (llegar a phase='over').
  'menu.dailyClash.title': 'Duelo del día',
  'menu.dailyClash.status.pending': 'Juega hoy y llega a {streak} días seguidos · +{coins} monedas al completar',
  'menu.dailyClash.status.done': '¡Completado hoy! {streak} días seguidos · nos vemos mañana',
  'menu.dailyClash.play': 'Jugar el duelo del día',
  'menu.dailyClash.doneButton': 'Hecho',

  'menu.mode': 'DURACIÓN',

  'menu.mode.60': '1 min',

  'menu.mode.180': '3 min',

  'menu.mode.300': '5 min',

  'menu.mode.desc': 'Mapa {cols} × {rows} · {players} jugadores',

  'menu.difficulty': 'DIFICULTAD',

  'menu.difficulty.auto': 'Auto',

  'menu.difficulty.easy': 'Fácil',

  'menu.difficulty.normal': 'Normal',

  'menu.difficulty.hard': 'Difícil',

  'menu.difficulty.elite': 'Élite',

  'menu.difficulty.auto.hint': 'La dificultad se ajusta automáticamente a tus últimos resultados.', // ★2026-08-22 T5: se quitó "bots"

  'menu.best': 'Mejor en este modo',

  'menu.best.none': '0', // ★2026-08-22 AI-tea T1: em-dash(값처럼 보이는 기호) 금지 -> 실제 빈 상태 값 0 (fmt(0)과 동일 표기, neon-thread 승인 전례)

  'menu.start': 'Empezar',


  'hud.rank.unit': 'POS',
  'hud.time.unit': 'SEG',

  // 3·5분 모드는 시간 칩이 m:ss 라 단위 라벨이 다르다.

  'hud.time.unit.long': 'TIEMPO',
  'hud.rate': '+{rate}/s',
  'hud.bounce': 'Rebote',
  'hud.bounce.aria': 'Rebote triple',

  'modal.pause.title': 'Pausa',
  'modal.pause.body': 'El juego está en pausa. Pulsa Atrás otra vez para abrir la confirmación de salida.',
  'modal.pause.resume': 'Reanudar',
  'modal.revive.title': 'Has perdido todo tu territorio',
  'modal.revive.body': 'Puedes reaparecer en un terreno libre con {size}. Solo {limit} por partida.',
  'modal.revive.limit': 'una vez',
  'modal.revive.decline': 'Resultados',
  'modal.revive.accept': 'Revivir',
  'modal.revive.body.free': 'Puedes reaparecer en un terreno libre con {size}. Gratis {limit} por partida.',
  'modal.revive.body.ad': 'Mira un anuncio corto para volver una vez más.',
  'modal.revive.accept.ad': 'Ver anuncio',
  'modal.revive.loading': 'Cargando anuncio…',
  'modal.exit.title': '¿Salir del juego?',
  'modal.exit.body': 'La partida en curso no se guardará.',
  'modal.exit.confirm': 'Salir',
  'modal.exit.cancel': 'Continuar',

  'result.newBest': '¡Nuevo récord!',
  'result.cells': 'Territorio final',
  'result.income': 'Renta del terreno',
  'result.kills': 'Eliminaciones',
  'result.maxTrail': 'Estela más larga',
  'result.coins': 'Monedas ganadas',
  'result.xp': 'XP',
  'result.restart': 'Jugar otra vez',

  'result.changeMode': 'Cambiar modo',

  'result.mode': '{mode} · {players} jugadores',
  'result.value.cells': '{percent}%',
  'result.value.kills': '{count}',
  'result.value.trail': '{count} casillas',
  'result.value.coins': '+{count}',
  'result.value.xp': '+{count}',

  'career.title': 'Trayectoria',
  'career.plays': 'Partidas jugadas',
  'career.wins': 'Primeros puestos',
  'career.kills': 'Eliminaciones totales',
  'career.xp': 'XP total',
  'career.value.plays': '{count}',
  'career.value.wins': '{count}',
  'career.value.kills': '{count}',
  'career.value.xp': '{count}',

  'fx.kill': '¡Eliminado!',

  'tier.normal': 'Normal',
  'tier.commercial': 'Comercial',
  'tier.special': 'Especial',
  'tier.label': '{name} ({value}/s)',

  'unit.you': 'Tú',
  'unit.ghost': '{nick} de ayer',

  'error.fatal.title': 'Algo salió mal',
  'error.noCanvas': 'No se pudo iniciar el juego (falta el elemento canvas).',
  'error.sdkInit': 'No se pudo inicializar el SDK.',
  'error.gameStart': 'No se pudo iniciar el juego.',

  'settings.language': 'Idioma',
  'settings.privacyLink': 'Política de privacidad',
  'settings.sound': 'Sonido',
  'settings.sound.on': 'Activado',
  'settings.sound.off': 'Desactivado',

  // ── Aviso push de Toss (Duelo del día) — ★2026-09-10. Solo se dibuja dentro de Toss (src/ui/pushOptIn.ts).
  'push.row.label': 'Aviso del Duelo del día',
  'push.row.get': 'Activar',
  'push.row.busy': 'Comprobando',
  'push.row.on': 'Activado',
  'push.row.retry': 'Activar de nuevo',
  'push.row.hint': 'Te avisamos cada día a las 19:00 (KST) cuando se abre el nuevo mapa del Duelo del día. Para desactivarlo, usa los ajustes de notificaciones de la app Toss.',
  'push.row.error': 'No se pudieron abrir los ajustes de notificaciones. Actualiza la app Toss a la última versión y vuelve a tocar.',
  'push.nudge.title': 'Recibir avisos del Duelo del día',
  'push.nudge.sub': 'Cada día a las 19:00 (KST), cuando se abre el nuevo mapa',
  'push.nudge.cta': 'Activar',
  'push.nudge.busy': 'Comprobando',
  'push.nudge.close': 'Cerrar el aviso',

  // ── Tarjeta de sugerencia «Money League» (pantalla de resultados, 1 vez al día) — ★2026-09-10 (src/ui/crossPromo.ts).
  'promo.ml.label': 'Sugerencia',
  'promo.ml.title': 'Money League',
  'promo.ml.sub': 'Inversión virtual en una liga de 10 000 bots',
  'promo.ml.open': 'Abrir',
  'promo.ml.close': 'Cerrar la sugerencia',
  'promo.ml.fail': 'No se pudo abrir ahora. Busca Money League en la app Toss.',

  'nick.name.0': 'Chaparrón Veloz',
  'nick.name.1': 'Diente de León Veloz',
  'nick.name.2': 'Urraca Veloz',
  'nick.name.3': 'Ocaso Veloz',
  'nick.name.4': 'Lápiz Veloz',
  'nick.name.5': 'Grulla Veloz',
  'nick.name.6': 'Molinillo Veloz',
  'nick.name.7': 'Botón Veloz',
  'nick.name.8': 'Chaparrón Sereno',
  'nick.name.9': 'Diente de León Sereno',
  'nick.name.10': 'Urraca Serena',
  'nick.name.11': 'Ocaso Sereno',
  'nick.name.12': 'Lápiz Sereno',
  'nick.name.13': 'Grulla Serena',
  'nick.name.14': 'Molinillo Sereno',
  'nick.name.15': 'Botón Sereno',
  'nick.name.16': 'Chaparrón Azul',
  'nick.name.17': 'Diente de León Azul',
  'nick.name.18': 'Urraca Azul',
  'nick.name.19': 'Ocaso Azul',
  'nick.name.20': 'Lápiz Azul',
  'nick.name.21': 'Grulla Azul',
  'nick.name.22': 'Molinillo Azul',
  'nick.name.23': 'Botón Azul',
  'nick.name.24': 'Chaparrón Pequeño',
  'nick.name.25': 'Diente de León Pequeño',
  'nick.name.26': 'Urraca Pequeña',
  'nick.name.27': 'Ocaso Pequeño',
  'nick.name.28': 'Lápiz Pequeño',
  'nick.name.29': 'Grulla Pequeña',
  'nick.name.30': 'Molinillo Pequeño',
  'nick.name.31': 'Botón Pequeño',
  'nick.name.32': 'Chaparrón Hondo',
  'nick.name.33': 'Diente de León Hondo',
  'nick.name.34': 'Urraca Honda',
  'nick.name.35': 'Ocaso Hondo',
  'nick.name.36': 'Lápiz Hondo',
  'nick.name.37': 'Grulla Honda',
  'nick.name.38': 'Molinillo Hondo',
  'nick.name.39': 'Botón Hondo',
  'nick.name.40': 'Chaparrón Claro',
  'nick.name.41': 'Diente de León Claro',
  'nick.name.42': 'Urraca Clara',
  'nick.name.43': 'Ocaso Claro',
  'nick.name.44': 'Lápiz Claro',
  'nick.name.45': 'Grulla Clara',
  'nick.name.46': 'Molinillo Claro',
  'nick.name.47': 'Botón Claro',
  'nick.name.48': 'Chaparrón Redondo',
  'nick.name.49': 'Diente de León Redondo',
  'nick.name.50': 'Urraca Redonda',
  'nick.name.51': 'Ocaso Redondo',
  'nick.name.52': 'Lápiz Redondo',
  'nick.name.53': 'Grulla Redonda',
  'nick.name.54': 'Molinillo Redondo',
  'nick.name.55': 'Botón Redondo',
  'nick.name.56': 'Chaparrón Firme',
  'nick.name.57': 'Diente de León Firme',
  'nick.name.58': 'Urraca Firme',
  'nick.name.59': 'Ocaso Firme',
  'nick.name.60': 'Lápiz Firme',
  'nick.name.61': 'Grulla Firme',
  'nick.name.62': 'Molinillo Firme',
  'nick.name.63': 'Botón Firme',

  'bot.name.0': 'Inmobiliaria Diligente',
  'bot.name.1': 'Terrateniente Diligente',
  'bot.name.2': 'Topógrafo Diligente',
  'bot.name.3': 'Pionero Diligente',
  'bot.name.4': 'Arquitecto Diligente',
  'bot.name.5': 'Inversor Diligente',
  'bot.name.6': 'Corredor Diligente',
  'bot.name.7': 'Rey de la Tierra Diligente',
  'bot.name.8': 'Inmobiliaria Calculadora',
  'bot.name.9': 'Terrateniente Calculador',
  'bot.name.10': 'Topógrafo Calculador',
  'bot.name.11': 'Pionero Calculador',
  'bot.name.12': 'Arquitecto Calculador',
  'bot.name.13': 'Inversor Calculador',
  'bot.name.14': 'Corredor Calculador',
  'bot.name.15': 'Rey de la Tierra Calculador',
  'bot.name.16': 'Inmobiliaria Tranquila',
  'bot.name.17': 'Terrateniente Tranquilo',
  'bot.name.18': 'Topógrafo Tranquilo',
  'bot.name.19': 'Pionero Tranquilo',
  'bot.name.20': 'Arquitecto Tranquilo',
  'bot.name.21': 'Inversor Tranquilo',
  'bot.name.22': 'Corredor Tranquilo',
  'bot.name.23': 'Rey de la Tierra Tranquilo',
  'bot.name.24': 'Inmobiliaria Tenaz',
  'bot.name.25': 'Terrateniente Tenaz',
  'bot.name.26': 'Topógrafo Tenaz',
  'bot.name.27': 'Pionero Tenaz',
  'bot.name.28': 'Arquitecto Tenaz',
  'bot.name.29': 'Inversor Tenaz',
  'bot.name.30': 'Corredor Tenaz',
  'bot.name.31': 'Rey de la Tierra Tenaz',
  'bot.name.32': 'Inmobiliaria Callada',
  'bot.name.33': 'Terrateniente Callado',
  'bot.name.34': 'Topógrafo Callado',
  'bot.name.35': 'Pionero Callado',
  'bot.name.36': 'Arquitecto Callado',
  'bot.name.37': 'Inversor Callado',
  'bot.name.38': 'Corredor Callado',
  'bot.name.39': 'Rey de la Tierra Callado',
  'bot.name.40': 'Inmobiliaria Audaz',
  'bot.name.41': 'Terrateniente Audaz',
  'bot.name.42': 'Topógrafo Audaz',
  'bot.name.43': 'Pionero Audaz',
  'bot.name.44': 'Arquitecto Audaz',
  'bot.name.45': 'Inversor Audaz',
  'bot.name.46': 'Corredor Audaz',
  'bot.name.47': 'Rey de la Tierra Audaz',
  'bot.name.48': 'Inmobiliaria Meticulosa',
  'bot.name.49': 'Terrateniente Meticuloso',
  'bot.name.50': 'Topógrafo Meticuloso',
  'bot.name.51': 'Pionero Meticuloso',
  'bot.name.52': 'Arquitecto Meticuloso',
  'bot.name.53': 'Inversor Meticuloso',
  'bot.name.54': 'Corredor Meticuloso',
  'bot.name.55': 'Rey de la Tierra Meticuloso',
  'bot.name.56': 'Inmobiliaria Perspicaz',
  'bot.name.57': 'Terrateniente Perspicaz',
  'bot.name.58': 'Topógrafo Perspicaz',
  'bot.name.59': 'Pionero Perspicaz',
  'bot.name.60': 'Arquitecto Perspicaz',
  'bot.name.61': 'Inversor Perspicaz',
  'bot.name.62': 'Corredor Perspicaz',
  'bot.name.63': 'Rey de la Tierra Perspicaz',
};

export default es;
