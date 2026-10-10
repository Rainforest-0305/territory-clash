/**
 * en — 기준 로케일이자 **키의 정본(source of truth)**.
 *
 * 다른 8개 로케일 파일은 `Messages`(= typeof en) 타입이 붙어 있어서,
 * 여기에 키를 더하거나 빼면 나머지 8개가 전부 컴파일 에러로 터진다.
 * 그것이 9명의 번역자가 서로 어긋나지 않게 막는 유일한 장치다.
 *
 * 규칙
 *  - 값 안에 HTML 태그를 넣지 않는다. 강조·구조는 코드가 만든다.
 *  - 치환은 반드시 이름 있는 자리표시자 {likeThis} 로 한다. 문자열 결합 금지.
 *  - 숫자는 Intl.NumberFormat 으로 이미 포맷된 채 들어온다.
 */
export const en = {
  // ── 제목은 두 갈래다. 절대 다시 하나로 합치지 마라 ──────────────────────
  //  brand.name  document.title 전용. **9개 로케일 전부 영문 브랜드 고정.**
  //    MSIX 가 EN-US 단일 언어로 등록되고 스토어 예약명이 'Territory Clash'
  //    라서, 이 자리만은 언어와 무관하게 제품 정체성을 유지해야 한다.
  //    토스 미니앱의 표시명은 granite.config.ts 의 brand.displayName 이 따로
  //    들고 있으므로(땅따먹기), 여기를 영문으로 둬도 한국 사용자가 잃는 게 없다.
  //  game.title  인게임 스플래시 / 카운트다운 / 캔버스 렌더용.
  //
  //    ★ 최종 규칙 (Partner 확정. 세 번 재론된 사안이니 다시 열지 마라)
  //      game.title 은 **해당 시장에 이미 등록된 이름이 있을 때만** 현지화한다.
  //      현재 해당하는 건 ko 하나뿐이다 — 땅따먹기 는 토스 콘솔에 등록된
  //      실제 이름이다. 나머지 8개 로케일은 영문 브랜드를 그대로 싣는다.
  //
  //      ko                                   땅따먹기
  //      en/ja/zh-Hans/es/pt-BR/de/fr/ru      Territory Clash
  //
  //    ★ 이유: 우리는 정식 상표 클리어런스를 할 수 없다. 8개 시장에 제목을
  //      새로 지어 붙이면 검증 불가능한 리스크를 8배로 늘리는 것과 같다.
  //      실제로 圈地大作战 은 무관한 중국 퍼블리셔 5곳 이상이 이미 출시한
  //      제목이었다(MS 정책 10.1.1). 검증 못 한 후보 제목들은 ja.ts /
  //      zh-Hans.ts 주석에 "trademark unverified — do not use" 로 남겨 뒀다.
  //
  //    ⚠ 이전에 있던 "비라틴 문자권은 현지화" 규칙은 **폐기됐다.** 그건 가독성
  //      논리였고, 상표 제약이 가독성보다 우선한다.
  //    ⚠ 값이 en 과 같다고 "미번역" 이 아니다. i18n:verify 경고가 떠도 의도된
  //      상태다. 번역자가 자국어 제목을 제안하더라도 등록 이름이 아니면 쓰지 마라.
  'brand.name': 'Territory Clash',
  'game.title': 'Territory Clash',

  'splash.subtitle': '{cols} × {rows}, {players} players, {seconds}s',

  // ── 시작 메뉴 (모드 · 난이도) ────────────────────────────────────────────
  //  ⚠ menu.mode.60/180/300 과 menu.difficulty.* 는 코드가 키를 «조립»해서
  //    부른다(menu.ts). 이름을 바꾸면 화면에 키 문자열이 그대로 나온다.
  //  ⚠ {players} 는 6·8·10 만 들어온다. ru 의 'игроков' 는 5~20 에서 맞으므로
  //    이 범위는 안전하다. 참가자 수를 2~4 로 내리면 ru 를 고쳐야 한다.
  'menu.subtitle': 'Pick a match length and difficulty',

  // Daily Clash (attendance) — ★new 2026-08-22. Win/loss doesn't matter; completion (reaching phase='over') does.
  'menu.dailyClash.title': 'Today\'s Clash',
  'menu.dailyClash.status.pending': 'Play today for day {streak} in a row · +{coins} coins on completion',
  'menu.dailyClash.status.done': 'Done for today! Day {streak} in a row · see you tomorrow',
  'menu.dailyClash.play': 'Play Today\'s Clash',
  'menu.dailyClash.doneButton': 'Done',
  'menu.mode': 'MATCH LENGTH',
  'menu.mode.60': '1 min',
  'menu.mode.180': '3 min',
  'menu.mode.300': '5 min',
  'menu.mode.desc': '{cols} × {rows} map · {players} players',
  'menu.difficulty': 'DIFFICULTY',
  'menu.difficulty.auto': 'Auto',
  'menu.difficulty.easy': 'Easy',
  'menu.difficulty.normal': 'Normal',
  'menu.difficulty.hard': 'Hard',
  'menu.difficulty.elite': 'Elite',
  'menu.difficulty.auto.hint': 'Difficulty adjusts automatically to your recent results.', // ★2026-08-22 T5: "Bots" wording removed
  'menu.best': 'Best in this mode',
  'menu.best.none': '0', // ★2026-08-22 AI-tea T1: em-dash(값처럼 보이는 기호) 금지 -> 실제 빈 상태 값 0 (fmt(0)과 동일 표기, neon-thread 승인 전례)
  'menu.start': 'Start',

  'hud.rank.unit': 'RANK',
  'hud.time.unit': 'SEC',
  // 3·5분 모드의 시간 칩은 초가 아니라 m:ss 라서 단위 라벨이 달라진다.
  'hud.time.unit.long': 'LEFT',
  'hud.rate': '+{rate}/s',
  'hud.bounce': 'Bounce',
  // 스크린리더 전용 라벨. **충전 3개가 아니다.** 게이지 하나로 120도씩 꺾이는
  // 3탄을 연속 발사하는 한 번의 동작이다(bots.ts startAutoBounce, types.ts
  // BounceState.shot = 0,1,2). 3 charges 로 쓰면 없는 시스템을 설명하게 된다.
  'hud.bounce.aria': 'Triple bounce',

  'modal.pause.title': 'Paused',
  'modal.pause.body': 'The game is on hold. Press back once more to open the quit confirmation.',
  'modal.pause.resume': 'Resume',
  'modal.revive.title': 'You lost all your territory',
  'modal.revive.body': 'You can respawn on empty land at {size}. Only {limit} per session.',
  'modal.revive.limit': 'once',
  'modal.revive.decline': 'See results',
  'modal.revive.accept': 'Revive',
  'modal.revive.body.free': 'You can respawn on empty land at {size}. The free revive is {limit} per session.',
  'modal.revive.body.ad': 'Watch a short ad to come back one more time.',
  'modal.revive.accept.ad': 'Watch ad & revive',
  'modal.revive.loading': 'Loading ad…',
  'modal.exit.title': 'Quit the game?',
  'modal.exit.body': 'Your run in progress won\'t be saved.',
  'modal.exit.confirm': 'Quit',
  'modal.exit.cancel': 'Keep playing',

  'result.newBest': 'New record!',
  'result.cells': 'Final territory',
  'result.income': 'Land income',
  'result.kills': 'Takedowns',
  'result.maxTrail': 'Longest trail',
  'result.coins': 'Coins earned',
  'result.xp': 'XP',
  'result.restart': 'Play again',
  'result.changeMode': 'Change mode',
  'result.mode': '{mode} · {players} players',
  'result.value.cells': '{percent}%',
  'result.value.kills': '{count}',
  'result.value.trail': '{count} tiles',
  'result.value.coins': '+{count}',
  'result.value.xp': '+{count}',

  'career.title': 'Career',
  'career.plays': 'Games played',
  'career.wins': '1st places',
  'career.kills': 'Total takedowns',
  'career.xp': 'Total XP',
  'career.value.plays': '{count}',
  'career.value.wins': '{count}',
  'career.value.kills': '{count}',
  'career.value.xp': '{count}',

  'fx.kill': 'Down!',

  'tier.normal': 'Standard',
  'tier.commercial': 'Commercial',
  'tier.special': 'Landmark',
  'tier.label': '{name} ({value}/s)',

  'unit.you': 'You',
  'unit.ghost': '{nick} (yesterday)',

  'error.fatal.title': 'Something went wrong',
  'error.noCanvas': 'Could not start the game (canvas element missing).',
  'error.sdkInit': 'Failed to initialize the SDK.',
  'error.gameStart': 'Failed to start the game.',

  'settings.language': 'Language',
  'settings.privacyLink': 'Privacy Policy',
  'settings.sound': 'Sound',
  'settings.sound.on': 'On',
  'settings.sound.off': 'Off',

  // ── 토스 푸시 알림(오늘의 대결) — ★2026-09-10 신설. 토스 안에서만 그려진다(src/ui/pushOptIn.ts).
  'push.row.label': 'Today\'s Clash alert',
  'push.row.get': 'Turn on',
  'push.row.busy': 'Checking',
  'push.row.on': 'On',
  'push.row.retry': 'Turn on again',
  'push.row.hint': 'We\'ll let you know at 7 PM (KST) every day when the new Today\'s Clash map opens. To turn it off, use notification settings in the Toss app.',
  'push.row.error': 'Couldn\'t open notification settings. Update the Toss app to the latest version and tap again.',
  'push.nudge.title': 'Today\'s Clash alerts',
  'push.nudge.sub': 'Daily at 7 PM (KST) for the new map',
  'push.nudge.cta': 'Turn on',
  'push.nudge.busy': 'Checking',
  'push.nudge.close': 'Dismiss alert prompt',

  // ── 「머니 리그」 교차추천 카드(결과 화면 하루 1회) — ★2026-09-10 신설(src/ui/crossPromo.ts).
  'promo.ml.label': 'Suggested',
  'promo.ml.title': 'Money League',
  'promo.ml.sub': 'Virtual trading in a 10,000-bot league',
  'promo.ml.open': 'Open',
  'promo.ml.close': 'Dismiss suggestion',
  'promo.ml.fail': 'Couldn\'t open it right now. Search for Money League in the Toss app.',

  'nick.name.0': 'Swift Shower',
  'nick.name.1': 'Swift Dandelion',
  'nick.name.2': 'Swift Magpie',
  'nick.name.3': 'Swift Sunset',
  'nick.name.4': 'Swift Pencil',
  'nick.name.5': 'Swift Crane',
  'nick.name.6': 'Swift Pinwheel',
  'nick.name.7': 'Swift Button',
  'nick.name.8': 'Calm Shower',
  'nick.name.9': 'Calm Dandelion',
  'nick.name.10': 'Calm Magpie',
  'nick.name.11': 'Calm Sunset',
  'nick.name.12': 'Calm Pencil',
  'nick.name.13': 'Calm Crane',
  'nick.name.14': 'Calm Pinwheel',
  'nick.name.15': 'Calm Button',
  'nick.name.16': 'Azure Shower',
  'nick.name.17': 'Azure Dandelion',
  'nick.name.18': 'Azure Magpie',
  'nick.name.19': 'Azure Sunset',
  'nick.name.20': 'Azure Pencil',
  'nick.name.21': 'Azure Crane',
  'nick.name.22': 'Azure Pinwheel',
  'nick.name.23': 'Azure Button',
  'nick.name.24': 'Tiny Shower',
  'nick.name.25': 'Tiny Dandelion',
  'nick.name.26': 'Tiny Magpie',
  'nick.name.27': 'Tiny Sunset',
  'nick.name.28': 'Tiny Pencil',
  'nick.name.29': 'Tiny Crane',
  'nick.name.30': 'Tiny Pinwheel',
  'nick.name.31': 'Tiny Button',
  'nick.name.32': 'Deep Shower',
  'nick.name.33': 'Deep Dandelion',
  'nick.name.34': 'Deep Magpie',
  'nick.name.35': 'Deep Sunset',
  'nick.name.36': 'Deep Pencil',
  'nick.name.37': 'Deep Crane',
  'nick.name.38': 'Deep Pinwheel',
  'nick.name.39': 'Deep Button',
  'nick.name.40': 'Clear Shower',
  'nick.name.41': 'Clear Dandelion',
  'nick.name.42': 'Clear Magpie',
  'nick.name.43': 'Clear Sunset',
  'nick.name.44': 'Clear Pencil',
  'nick.name.45': 'Clear Crane',
  'nick.name.46': 'Clear Pinwheel',
  'nick.name.47': 'Clear Button',
  'nick.name.48': 'Round Shower',
  'nick.name.49': 'Round Dandelion',
  'nick.name.50': 'Round Magpie',
  'nick.name.51': 'Round Sunset',
  'nick.name.52': 'Round Pencil',
  'nick.name.53': 'Round Crane',
  'nick.name.54': 'Round Pinwheel',
  'nick.name.55': 'Round Button',
  'nick.name.56': 'Sturdy Shower',
  'nick.name.57': 'Sturdy Dandelion',
  'nick.name.58': 'Sturdy Magpie',
  'nick.name.59': 'Sturdy Sunset',
  'nick.name.60': 'Sturdy Pencil',
  'nick.name.61': 'Sturdy Crane',
  'nick.name.62': 'Sturdy Pinwheel',
  'nick.name.63': 'Sturdy Button',

  'bot.name.0': 'Keen Agent',
  'bot.name.1': 'Keen Landlord',
  'bot.name.2': 'Keen Surveyor',
  'bot.name.3': 'Keen Pioneer',
  'bot.name.4': 'Keen Builder',
  'bot.name.5': 'Keen Investor',
  'bot.name.6': 'Keen Broker',
  'bot.name.7': 'Keen Land King',
  'bot.name.8': 'Cold Agent',
  'bot.name.9': 'Cold Landlord',
  'bot.name.10': 'Cold Surveyor',
  'bot.name.11': 'Cold Pioneer',
  'bot.name.12': 'Cold Builder',
  'bot.name.13': 'Cold Investor',
  'bot.name.14': 'Cold Broker',
  'bot.name.15': 'Cold Land King',
  'bot.name.16': 'Easy Agent',
  'bot.name.17': 'Easy Landlord',
  'bot.name.18': 'Easy Surveyor',
  'bot.name.19': 'Easy Pioneer',
  'bot.name.20': 'Easy Builder',
  'bot.name.21': 'Easy Investor',
  'bot.name.22': 'Easy Broker',
  'bot.name.23': 'Easy Land King',
  'bot.name.24': 'Dogged Agent',
  'bot.name.25': 'Dogged Landlord',
  'bot.name.26': 'Dogged Surveyor',
  'bot.name.27': 'Dogged Pioneer',
  'bot.name.28': 'Dogged Builder',
  'bot.name.29': 'Dogged Investor',
  'bot.name.30': 'Dogged Broker',
  'bot.name.31': 'Dogged Land King',
  'bot.name.32': 'Quiet Agent',
  'bot.name.33': 'Quiet Landlord',
  'bot.name.34': 'Quiet Surveyor',
  'bot.name.35': 'Quiet Pioneer',
  'bot.name.36': 'Quiet Builder',
  'bot.name.37': 'Quiet Investor',
  'bot.name.38': 'Quiet Broker',
  'bot.name.39': 'Quiet Land King',
  'bot.name.40': 'Bold Agent',
  'bot.name.41': 'Bold Landlord',
  'bot.name.42': 'Bold Surveyor',
  'bot.name.43': 'Bold Pioneer',
  'bot.name.44': 'Bold Builder',
  'bot.name.45': 'Bold Investor',
  'bot.name.46': 'Bold Broker',
  'bot.name.47': 'Bold Land King',
  'bot.name.48': 'Exact Agent',
  'bot.name.49': 'Exact Landlord',
  'bot.name.50': 'Exact Surveyor',
  'bot.name.51': 'Exact Pioneer',
  'bot.name.52': 'Exact Builder',
  'bot.name.53': 'Exact Investor',
  'bot.name.54': 'Exact Broker',
  'bot.name.55': 'Exact Land King',
  'bot.name.56': 'Sharp Agent',
  'bot.name.57': 'Sharp Landlord',
  'bot.name.58': 'Sharp Surveyor',
  'bot.name.59': 'Sharp Pioneer',
  'bot.name.60': 'Sharp Builder',
  'bot.name.61': 'Sharp Investor',
  'bot.name.62': 'Sharp Broker',
  'bot.name.63': 'Sharp Land King',
};

export default en;
