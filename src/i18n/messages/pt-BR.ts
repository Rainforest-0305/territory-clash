/**
 * pt-BR — português do Brasil (NÃO português europeu).
 *
 * 규칙
 *  - 키는 동결이다. 추가/삭제/이름변경 금지 (하면 컴파일 에러가 난다).
 *  - {likeThis} 자리표시자는 철자 그대로 유지한다(어순 재배치는 허용).
 *  - 값 안에 HTML 태그를 넣지 않는다.
 *
 * 번역 노트
 *  - 브라질 어휘·표기 기준(arquiteto, corretor, partida, "Você").
 *  - game.title 은 스토어 제품 아이덴티티라 영문 브랜드 그대로 둔다.
 *  - nick.name.*  : 8 형용사 × 8 자연 명사. 명사 뒤 형용사 + 성수 일치.
 *                   Aguaceiro(m)·Dente-de-Leão(m)·Gralha(f)·Entardecer(m)·
 *                   Lápis(m)·Garça(f)·Cata-Vento(m)·Botão(m)
 *                   까치→Gralha, 두루미→Garça 로 브라질 조류 치환(인지도).
 *  - bot.name.*   : 8 형용사 × 8 부동산 직함. 동일 규칙.
 *                   Imobiliária(f)·Proprietário(m)·Agrimensor(m)·Pioneiro(m)·
 *                   Arquiteto(m)·Investidor(m)·Corretor(m)·Rei da Terra(m)
 */
import type { Messages } from '../types';

const pt_BR: Messages = {
  // brand.name = document.title 전용(9개 언어 모두 영문 브랜드 고정).
  // game.title = 인게임 표시용(현지화 대상). 둘을 다시 합치지 마라 — en.ts 주석 참고.
  'brand.name': 'Territory Clash',
  'game.title': 'Territory Clash',

  'splash.subtitle': '{cols} × {rows}, {players} jogadores, {seconds} s',

  // 시작 메뉴(모드·난이도). menu.mode.* / menu.difficulty.* 는 코드가 키를 조립한다.

  'menu.subtitle': 'Escolha a duração e a dificuldade',

  // Duelo do dia (presença) — ★novo 2026-08-22. Vitória/derrota não importa; o que importa é concluir (chegar a phase='over').
  'menu.dailyClash.title': 'Duelo do dia',
  'menu.dailyClash.status.pending': 'Jogue hoje e chegue a {streak} dias seguidos · +{coins} moedas ao completar',
  'menu.dailyClash.status.done': 'Concluído hoje! {streak} dias seguidos · até amanhã',
  'menu.dailyClash.play': 'Jogar o duelo do dia',
  'menu.dailyClash.doneButton': 'Concluído',

  'menu.mode': 'DURAÇÃO',

  'menu.mode.60': '1 min',

  'menu.mode.180': '3 min',

  'menu.mode.300': '5 min',

  'menu.mode.desc': 'Mapa {cols} × {rows} · {players} jogadores',

  'menu.difficulty': 'DIFICULDADE',

  'menu.difficulty.auto': 'Auto',

  'menu.difficulty.easy': 'Fácil',

  'menu.difficulty.normal': 'Normal',

  'menu.difficulty.hard': 'Difícil',

  'menu.difficulty.elite': 'Elite',

  'menu.difficulty.auto.hint': 'A dificuldade se ajusta automaticamente aos seus resultados recentes.', // ★2026-08-22 T5: "bots" removido

  'menu.best': 'Melhor neste modo',

  'menu.best.none': '0', // ★2026-08-22 AI-tea T1: em-dash(값처럼 보이는 기호) 금지 -> 실제 빈 상태 값 0 (fmt(0)과 동일 표기, neon-thread 승인 전례)

  'menu.start': 'Começar',


  'hud.rank.unit': 'POS',
  'hud.time.unit': 'SEG',

  // 3·5분 모드는 시간 칩이 m:ss 라 단위 라벨이 다르다.

  'hud.time.unit.long': 'TEMPO',
  'hud.rate': '+{rate}/s',
  'hud.bounce': 'Rebote',
  'hud.bounce.aria': 'Rebote triplo',

  'modal.pause.title': 'Pausado',
  'modal.pause.body': 'O jogo está pausado. Pressione Voltar mais uma vez para abrir a confirmação de saída.',
  'modal.pause.resume': 'Retomar',
  'modal.revive.title': 'Você perdeu todo o seu território',
  'modal.revive.body': 'Você pode renascer em um terreno vazio com {size}. Apenas {limit} por partida.',
  'modal.revive.limit': 'uma vez',
  'modal.revive.decline': 'Resultados',
  'modal.revive.accept': 'Renascer',
  'modal.revive.body.free': 'Você pode renascer em um terreno vazio com {size}. Grátis {limit} por partida.',
  'modal.revive.body.ad': 'Assista a um anúncio curto para voltar mais uma vez.',
  'modal.revive.accept.ad': 'Ver anúncio',
  'modal.revive.loading': 'Carregando anúncio…',
  'modal.exit.title': 'Sair do jogo?',
  'modal.exit.body': 'A partida em andamento não será salva.',
  'modal.exit.confirm': 'Sair',
  'modal.exit.cancel': 'Continuar',

  'result.newBest': 'Novo recorde!',
  'result.cells': 'Território final',
  'result.income': 'Renda do terreno',
  'result.kills': 'Eliminações',
  'result.maxTrail': 'Maior rastro',
  'result.coins': 'Moedas ganhas',
  'result.xp': 'XP',
  'result.restart': 'Jogar de novo',

  'result.changeMode': 'Mudar modo',

  'result.mode': '{mode} · {players} jogadores',
  'result.value.cells': '{percent}%',
  'result.value.kills': '{count}',
  'result.value.trail': '{count} blocos',
  'result.value.coins': '+{count}',
  'result.value.xp': '+{count}',

  'career.title': 'Carreira',
  'career.plays': 'Partidas jogadas',
  'career.wins': 'Primeiros lugares',
  'career.kills': 'Eliminações totais',
  'career.xp': 'XP total',
  'career.value.plays': '{count}',
  'career.value.wins': '{count}',
  'career.value.kills': '{count}',
  'career.value.xp': '{count}',

  'fx.kill': 'Eliminado!',

  'tier.normal': 'Normal',
  'tier.commercial': 'Comercial',
  'tier.special': 'Especial',
  'tier.label': '{name} ({value}/s)',

  'unit.you': 'Você',
  'unit.ghost': '{nick} de ontem',

  'error.fatal.title': 'Algo deu errado',
  'error.noCanvas': 'Não foi possível iniciar o jogo (elemento canvas não encontrado).',
  'error.sdkInit': 'Falha ao inicializar o SDK.',
  'error.gameStart': 'Falha ao iniciar o jogo.',

  'settings.language': 'Idioma',
  'settings.privacyLink': 'Política de Privacidade',
  'settings.sound': 'Som',
  'settings.sound.on': 'Ligado',
  'settings.sound.off': 'Desligado',

  // ── Alerta push do Toss (Duelo do dia) — ★2026-09-10. Só aparece dentro do Toss (src/ui/pushOptIn.ts).
  'push.row.label': 'Alerta do Duelo do dia',
  'push.row.get': 'Ativar',
  'push.row.busy': 'Verificando',
  'push.row.on': 'Ativado',
  'push.row.retry': 'Ativar de novo',
  'push.row.hint': 'Avisamos você todo dia às 19h (KST) quando o novo mapa do Duelo do dia abrir. Para desativar, use as configurações de notificação do app Toss.',
  'push.row.error': 'Não foi possível abrir as configurações de notificação. Atualize o app Toss para a versão mais recente e toque de novo.',
  'push.nudge.title': 'Receber alertas do Duelo do dia',
  'push.nudge.sub': 'Todo dia às 19h (KST), quando o novo mapa abrir',
  'push.nudge.cta': 'Ativar',
  'push.nudge.busy': 'Verificando',
  'push.nudge.close': 'Fechar o aviso',

  // ── Cartão de sugestão «Money League» (tela de resultado, 1 vez por dia) — ★2026-09-10 (src/ui/crossPromo.ts).
  'promo.ml.label': 'Sugestão',
  'promo.ml.title': 'Money League',
  'promo.ml.sub': 'Investimento virtual em uma liga com 10 mil bots',
  'promo.ml.open': 'Abrir',
  'promo.ml.close': 'Fechar a sugestão',
  'promo.ml.fail': 'Não deu para abrir agora. Procure Money League no app Toss.',

  'nick.name.0': 'Aguaceiro Veloz',
  'nick.name.1': 'Dente-de-Leão Veloz',
  'nick.name.2': 'Gralha Veloz',
  'nick.name.3': 'Entardecer Veloz',
  'nick.name.4': 'Lápis Veloz',
  'nick.name.5': 'Garça Veloz',
  'nick.name.6': 'Cata-Vento Veloz',
  'nick.name.7': 'Botão Veloz',
  'nick.name.8': 'Aguaceiro Sereno',
  'nick.name.9': 'Dente-de-Leão Sereno',
  'nick.name.10': 'Gralha Serena',
  'nick.name.11': 'Entardecer Sereno',
  'nick.name.12': 'Lápis Sereno',
  'nick.name.13': 'Garça Serena',
  'nick.name.14': 'Cata-Vento Sereno',
  'nick.name.15': 'Botão Sereno',
  'nick.name.16': 'Aguaceiro Azul',
  'nick.name.17': 'Dente-de-Leão Azul',
  'nick.name.18': 'Gralha Azul',
  'nick.name.19': 'Entardecer Azul',
  'nick.name.20': 'Lápis Azul',
  'nick.name.21': 'Garça Azul',
  'nick.name.22': 'Cata-Vento Azul',
  'nick.name.23': 'Botão Azul',
  'nick.name.24': 'Aguaceiro Pequeno',
  'nick.name.25': 'Dente-de-Leão Pequeno',
  'nick.name.26': 'Gralha Pequena',
  'nick.name.27': 'Entardecer Pequeno',
  'nick.name.28': 'Lápis Pequeno',
  'nick.name.29': 'Garça Pequena',
  'nick.name.30': 'Cata-Vento Pequeno',
  'nick.name.31': 'Botão Pequeno',
  'nick.name.32': 'Aguaceiro Profundo',
  'nick.name.33': 'Dente-de-Leão Profundo',
  'nick.name.34': 'Gralha Profunda',
  'nick.name.35': 'Entardecer Profundo',
  'nick.name.36': 'Lápis Profundo',
  'nick.name.37': 'Garça Profunda',
  'nick.name.38': 'Cata-Vento Profundo',
  'nick.name.39': 'Botão Profundo',
  'nick.name.40': 'Aguaceiro Claro',
  'nick.name.41': 'Dente-de-Leão Claro',
  'nick.name.42': 'Gralha Clara',
  'nick.name.43': 'Entardecer Claro',
  'nick.name.44': 'Lápis Claro',
  'nick.name.45': 'Garça Clara',
  'nick.name.46': 'Cata-Vento Claro',
  'nick.name.47': 'Botão Claro',
  'nick.name.48': 'Aguaceiro Redondo',
  'nick.name.49': 'Dente-de-Leão Redondo',
  'nick.name.50': 'Gralha Redonda',
  'nick.name.51': 'Entardecer Redondo',
  'nick.name.52': 'Lápis Redondo',
  'nick.name.53': 'Garça Redonda',
  'nick.name.54': 'Cata-Vento Redondo',
  'nick.name.55': 'Botão Redondo',
  'nick.name.56': 'Aguaceiro Firme',
  'nick.name.57': 'Dente-de-Leão Firme',
  'nick.name.58': 'Gralha Firme',
  'nick.name.59': 'Entardecer Firme',
  'nick.name.60': 'Lápis Firme',
  'nick.name.61': 'Garça Firme',
  'nick.name.62': 'Cata-Vento Firme',
  'nick.name.63': 'Botão Firme',

  'bot.name.0': 'Imobiliária Dedicada',
  'bot.name.1': 'Proprietário Dedicado',
  'bot.name.2': 'Agrimensor Dedicado',
  'bot.name.3': 'Pioneiro Dedicado',
  'bot.name.4': 'Arquiteto Dedicado',
  'bot.name.5': 'Investidor Dedicado',
  'bot.name.6': 'Corretor Dedicado',
  'bot.name.7': 'Rei da Terra Dedicado',
  'bot.name.8': 'Imobiliária Fria',
  'bot.name.9': 'Proprietário Frio',
  'bot.name.10': 'Agrimensor Frio',
  'bot.name.11': 'Pioneiro Frio',
  'bot.name.12': 'Arquiteto Frio',
  'bot.name.13': 'Investidor Frio',
  'bot.name.14': 'Corretor Frio',
  'bot.name.15': 'Rei da Terra Frio',
  'bot.name.16': 'Imobiliária Tranquila',
  'bot.name.17': 'Proprietário Tranquilo',
  'bot.name.18': 'Agrimensor Tranquilo',
  'bot.name.19': 'Pioneiro Tranquilo',
  'bot.name.20': 'Arquiteto Tranquilo',
  'bot.name.21': 'Investidor Tranquilo',
  'bot.name.22': 'Corretor Tranquilo',
  'bot.name.23': 'Rei da Terra Tranquilo',
  'bot.name.24': 'Imobiliária Obstinada',
  'bot.name.25': 'Proprietário Obstinado',
  'bot.name.26': 'Agrimensor Obstinado',
  'bot.name.27': 'Pioneiro Obstinado',
  'bot.name.28': 'Arquiteto Obstinado',
  'bot.name.29': 'Investidor Obstinado',
  'bot.name.30': 'Corretor Obstinado',
  'bot.name.31': 'Rei da Terra Obstinado',
  'bot.name.32': 'Imobiliária Calada',
  'bot.name.33': 'Proprietário Calado',
  'bot.name.34': 'Agrimensor Calado',
  'bot.name.35': 'Pioneiro Calado',
  'bot.name.36': 'Arquiteto Calado',
  'bot.name.37': 'Investidor Calado',
  'bot.name.38': 'Corretor Calado',
  'bot.name.39': 'Rei da Terra Calado',
  'bot.name.40': 'Imobiliária Ousada',
  'bot.name.41': 'Proprietário Ousado',
  'bot.name.42': 'Agrimensor Ousado',
  'bot.name.43': 'Pioneiro Ousado',
  'bot.name.44': 'Arquiteto Ousado',
  'bot.name.45': 'Investidor Ousado',
  'bot.name.46': 'Corretor Ousado',
  'bot.name.47': 'Rei da Terra Ousado',
  'bot.name.48': 'Imobiliária Meticulosa',
  'bot.name.49': 'Proprietário Meticuloso',
  'bot.name.50': 'Agrimensor Meticuloso',
  'bot.name.51': 'Pioneiro Meticuloso',
  'bot.name.52': 'Arquiteto Meticuloso',
  'bot.name.53': 'Investidor Meticuloso',
  'bot.name.54': 'Corretor Meticuloso',
  'bot.name.55': 'Rei da Terra Meticuloso',
  'bot.name.56': 'Imobiliária Atenta',
  'bot.name.57': 'Proprietário Atento',
  'bot.name.58': 'Agrimensor Atento',
  'bot.name.59': 'Pioneiro Atento',
  'bot.name.60': 'Arquiteto Atento',
  'bot.name.61': 'Investidor Atento',
  'bot.name.62': 'Corretor Atento',
  'bot.name.63': 'Rei da Terra Atento',
};

export default pt_BR;
