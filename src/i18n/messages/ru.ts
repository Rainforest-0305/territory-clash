/**
 * ru — Русский.
 *
 * 번역자에게:
 *  - 키는 동결이다. 추가/삭제/이름변경 금지 (하면 컴파일 에러가 난다).
 *  - {likeThis} 자리표시자는 철자 그대로 유지하고, en 에 있는 것은 전부 남긴다.
 *  - 값 안에 HTML 태그를 넣지 않는다.
 *
 * 이름 풀(64+64)은 8x8 격자를 그대로 유지한다(idx = i*8 + j).
 *  nick: Быстрый/Тихий/Синий/Малый/Глубокий/Ясный/Круглый/Крепкий
 *        x Ливень/Одуванчик/Сорока/Закат/Карандаш/Журавль/Юла/Пуговица
 *       — 명사 성에 맞춰 형용사를 굴절시킨다.
 *          남성: Ливень·Одуванчик·Закат·Карандаш·Журавль (-ый/-ий)
 *          여성: Сорока·Юла·Пуговица (-ая/-яя)
 *  bot:  Усердный/Холодный/Неспешный/Упорный/Тихий/Смелый/Дотошный/Зоркий
 *        x Риелтор/Помещик/Землемер/Старатель/Зодчий/Инвестор/Маклер/Магнат
 *       — 명사 8종이 전부 남성이라 어미는 전부 -ый/-ий.
 */
import type { Messages } from '../types';

const ru: Messages = {
  // brand.name = document.title 전용(9개 언어 모두 영문 브랜드 고정).
  // game.title = 인게임 표시용(현지화 대상). 둘을 다시 합치지 마라 — en.ts 주석 참고.
  'brand.name': 'Territory Clash',
  'game.title': 'Territory Clash',

  'splash.subtitle': '{cols} × {rows}, {players} игроков, {seconds} с',

  // 시작 메뉴(모드·난이도). menu.mode.* / menu.difficulty.* 는 코드가 키를 조립한다.

  'menu.subtitle': 'Выберите длительность и сложность',

  // Схватка дня (посещаемость) — ★новое 2026-08-22. Победа/поражение неважны; важно завершение (достижение phase='over').
  'menu.dailyClash.title': 'Схватка дня',
  'menu.dailyClash.status.pending': 'Сыграйте сегодня: будет {streak} дней подряд · +{coins} монет за завершение',
  'menu.dailyClash.status.done': 'Сегодня выполнено! {streak} дней подряд · до завтра',
  'menu.dailyClash.play': 'Играть в схватку дня',
  'menu.dailyClash.doneButton': 'Выполнено',

  'menu.mode': 'ДЛИТЕЛЬНОСТЬ',

  'menu.mode.60': '1 мин',

  'menu.mode.180': '3 мин',

  'menu.mode.300': '5 мин',

  'menu.mode.desc': 'Карта {cols} × {rows} · {players} игроков',

  'menu.difficulty': 'СЛОЖНОСТЬ',

  'menu.difficulty.auto': 'Авто',

  'menu.difficulty.easy': 'Легко',

  'menu.difficulty.normal': 'Обычно',

  'menu.difficulty.hard': 'Сложно',

  'menu.difficulty.elite': 'Элита',

  'menu.difficulty.auto.hint': 'Сложность подстраивается автоматически под ваши последние результаты.', // ★2026-08-22 T5: убрано слово "боты"

  'menu.best': 'Рекорд в этом режиме',

  'menu.best.none': '0', // ★2026-08-22 AI-tea T1: em-dash(값처럼 보이는 기호) 금지 -> 실제 빈 상태 값 0 (fmt(0)과 동일 표기, neon-thread 승인 전례)

  'menu.start': 'Начать',


  'hud.rank.unit': 'МЕСТО',
  'hud.time.unit': 'СЕК',

  // 3·5분 모드는 시간 칩이 m:ss 라 단위 라벨이 다르다.

  'hud.time.unit.long': 'ВРЕМЯ',
  'hud.rate': '+{rate}/с',
  'hud.bounce': 'Отскок',
  'hud.bounce.aria': 'Тройной отскок',

  'modal.pause.title': 'Пауза',
  'modal.pause.body':
    'Игра на паузе. Нажмите «Назад» ещё раз: появится запрос на выход.',
  'modal.pause.resume': 'Продолжить',
  'modal.revive.title': 'Вы потеряли всю территорию',
  'modal.revive.body':
    'Можно возродиться на свободной земле с участком {size}. Только {limit} за игру.',
  'modal.revive.limit': 'один раз',
  'modal.revive.decline': 'Итоги',
  'modal.revive.accept': 'Возродиться',
  'modal.revive.body.free': 'Можно возродиться на свободной земле с участком {size}. Бесплатно {limit} за игру.',
  'modal.revive.body.ad': 'Посмотрите короткую рекламу, чтобы вернуться ещё раз.',
  'modal.revive.accept.ad': 'Смотреть рекламу',
  'modal.revive.loading': 'Загрузка рекламы…',
  'modal.exit.title': 'Выйти из игры?',
  'modal.exit.body': 'Текущая игра не сохранится.',
  'modal.exit.confirm': 'Выход',
  'modal.exit.cancel': 'Продолжить',

  'result.newBest': 'Новый рекорд!',
  'result.cells': 'Итоговая территория',
  'result.income': 'Доход с земли',
  'result.kills': 'Устранения',
  'result.maxTrail': 'Самый длинный след',
  'result.coins': 'Монеты',
  'result.xp': 'Опыт',
  'result.restart': 'Ещё раз',

  'result.changeMode': 'Сменить режим',

  'result.mode': '{mode} · {players} игроков',
  'result.value.cells': '{percent}%',
  'result.value.kills': '{count}',
  'result.value.trail': '{count} кл.',
  'result.value.coins': '+{count}',
  'result.value.xp': '+{count}',

  'career.title': 'Статистика',
  'career.plays': 'Сыграно партий',
  'career.wins': 'Первых мест',
  'career.kills': 'Всего устранений',
  'career.xp': 'Всего опыта',
  'career.value.plays': '{count}',
  'career.value.wins': '{count}',
  'career.value.kills': '{count}',
  'career.value.xp': '{count}',

  'fx.kill': 'Готов!',

  'tier.normal': 'Обычный',
  'tier.commercial': 'Торговый',
  'tier.special': 'Особый',
  'tier.label': '{name} ({value}/с)',

  'unit.you': 'Вы',
  'unit.ghost': '{nick} (вчера)',

  'error.fatal.title': 'Что-то пошло не так',
  'error.noCanvas': 'Не удалось запустить игру (нет элемента canvas).',
  'error.sdkInit': 'Не удалось инициализировать SDK.',
  'error.gameStart': 'Не удалось запустить игру.',

  'settings.language': 'Язык',
  'settings.privacyLink': 'Политика конфиденциальности',
  'settings.sound': 'Звук',
  'settings.sound.on': 'Вкл.',
  'settings.sound.off': 'Выкл.',

  // ── Push-уведомление Toss (Схватка дня) — ★2026-09-10. Рисуется только внутри Toss (src/ui/pushOptIn.ts).
  'push.row.label': 'Уведомление о Схватке дня',
  'push.row.get': 'Включить',
  'push.row.busy': 'Проверка',
  'push.row.on': 'Включено',
  'push.row.retry': 'Включить снова',
  'push.row.hint': 'Каждый день в 19:00 (KST) сообщим, когда откроется новая карта Схватки дня. Отключить можно в настройках уведомлений приложения Toss.',
  'push.row.error': 'Не удалось открыть настройки уведомлений. Обновите приложение Toss до последней версии и нажмите ещё раз.',
  'push.nudge.title': 'Получать уведомления о Схватке дня',
  'push.nudge.sub': 'Каждый день в 19:00 (KST), когда откроется новая карта',
  'push.nudge.cta': 'Включить',
  'push.nudge.busy': 'Проверка',
  'push.nudge.close': 'Закрыть подсказку',

  // ── Карточка-рекомендация «Money League» (экран результата, 1 раз в день) — ★2026-09-10 (src/ui/crossPromo.ts).
  'promo.ml.label': 'Рекомендуем',
  'promo.ml.title': 'Money League',
  'promo.ml.sub': 'Виртуальные инвестиции в лиге из 10 000 ботов',
  'promo.ml.open': 'Открыть',
  'promo.ml.close': 'Закрыть рекомендацию',
  'promo.ml.fail': 'Сейчас открыть не получилось. Найдите Money League в приложении Toss.',

  'nick.name.0': 'Быстрый Ливень',
  'nick.name.1': 'Быстрый Одуванчик',
  'nick.name.2': 'Быстрая Сорока',
  'nick.name.3': 'Быстрый Закат',
  'nick.name.4': 'Быстрый Карандаш',
  'nick.name.5': 'Быстрый Журавль',
  'nick.name.6': 'Быстрая Юла',
  'nick.name.7': 'Быстрая Пуговица',
  'nick.name.8': 'Тихий Ливень',
  'nick.name.9': 'Тихий Одуванчик',
  'nick.name.10': 'Тихая Сорока',
  'nick.name.11': 'Тихий Закат',
  'nick.name.12': 'Тихий Карандаш',
  'nick.name.13': 'Тихий Журавль',
  'nick.name.14': 'Тихая Юла',
  'nick.name.15': 'Тихая Пуговица',
  'nick.name.16': 'Синий Ливень',
  'nick.name.17': 'Синий Одуванчик',
  'nick.name.18': 'Синяя Сорока',
  'nick.name.19': 'Синий Закат',
  'nick.name.20': 'Синий Карандаш',
  'nick.name.21': 'Синий Журавль',
  'nick.name.22': 'Синяя Юла',
  'nick.name.23': 'Синяя Пуговица',
  'nick.name.24': 'Малый Ливень',
  'nick.name.25': 'Малый Одуванчик',
  'nick.name.26': 'Малая Сорока',
  'nick.name.27': 'Малый Закат',
  'nick.name.28': 'Малый Карандаш',
  'nick.name.29': 'Малый Журавль',
  'nick.name.30': 'Малая Юла',
  'nick.name.31': 'Малая Пуговица',
  'nick.name.32': 'Глубокий Ливень',
  'nick.name.33': 'Глубокий Одуванчик',
  'nick.name.34': 'Глубокая Сорока',
  'nick.name.35': 'Глубокий Закат',
  'nick.name.36': 'Глубокий Карандаш',
  'nick.name.37': 'Глубокий Журавль',
  'nick.name.38': 'Глубокая Юла',
  'nick.name.39': 'Глубокая Пуговица',
  'nick.name.40': 'Ясный Ливень',
  'nick.name.41': 'Ясный Одуванчик',
  'nick.name.42': 'Ясная Сорока',
  'nick.name.43': 'Ясный Закат',
  'nick.name.44': 'Ясный Карандаш',
  'nick.name.45': 'Ясный Журавль',
  'nick.name.46': 'Ясная Юла',
  'nick.name.47': 'Ясная Пуговица',
  'nick.name.48': 'Круглый Ливень',
  'nick.name.49': 'Круглый Одуванчик',
  'nick.name.50': 'Круглая Сорока',
  'nick.name.51': 'Круглый Закат',
  'nick.name.52': 'Круглый Карандаш',
  'nick.name.53': 'Круглый Журавль',
  'nick.name.54': 'Круглая Юла',
  'nick.name.55': 'Круглая Пуговица',
  'nick.name.56': 'Крепкий Ливень',
  'nick.name.57': 'Крепкий Одуванчик',
  'nick.name.58': 'Крепкая Сорока',
  'nick.name.59': 'Крепкий Закат',
  'nick.name.60': 'Крепкий Карандаш',
  'nick.name.61': 'Крепкий Журавль',
  'nick.name.62': 'Крепкая Юла',
  'nick.name.63': 'Крепкая Пуговица',

  'bot.name.0': 'Усердный Риелтор',
  'bot.name.1': 'Усердный Помещик',
  'bot.name.2': 'Усердный Землемер',
  'bot.name.3': 'Усердный Старатель',
  'bot.name.4': 'Усердный Зодчий',
  'bot.name.5': 'Усердный Инвестор',
  'bot.name.6': 'Усердный Маклер',
  'bot.name.7': 'Усердный Магнат',
  'bot.name.8': 'Холодный Риелтор',
  'bot.name.9': 'Холодный Помещик',
  'bot.name.10': 'Холодный Землемер',
  'bot.name.11': 'Холодный Старатель',
  'bot.name.12': 'Холодный Зодчий',
  'bot.name.13': 'Холодный Инвестор',
  'bot.name.14': 'Холодный Маклер',
  'bot.name.15': 'Холодный Магнат',
  'bot.name.16': 'Неспешный Риелтор',
  'bot.name.17': 'Неспешный Помещик',
  'bot.name.18': 'Неспешный Землемер',
  'bot.name.19': 'Неспешный Старатель',
  'bot.name.20': 'Неспешный Зодчий',
  'bot.name.21': 'Неспешный Инвестор',
  'bot.name.22': 'Неспешный Маклер',
  'bot.name.23': 'Неспешный Магнат',
  'bot.name.24': 'Упорный Риелтор',
  'bot.name.25': 'Упорный Помещик',
  'bot.name.26': 'Упорный Землемер',
  'bot.name.27': 'Упорный Старатель',
  'bot.name.28': 'Упорный Зодчий',
  'bot.name.29': 'Упорный Инвестор',
  'bot.name.30': 'Упорный Маклер',
  'bot.name.31': 'Упорный Магнат',
  'bot.name.32': 'Тихий Риелтор',
  'bot.name.33': 'Тихий Помещик',
  'bot.name.34': 'Тихий Землемер',
  'bot.name.35': 'Тихий Старатель',
  'bot.name.36': 'Тихий Зодчий',
  'bot.name.37': 'Тихий Инвестор',
  'bot.name.38': 'Тихий Маклер',
  'bot.name.39': 'Тихий Магнат',
  'bot.name.40': 'Смелый Риелтор',
  'bot.name.41': 'Смелый Помещик',
  'bot.name.42': 'Смелый Землемер',
  'bot.name.43': 'Смелый Старатель',
  'bot.name.44': 'Смелый Зодчий',
  'bot.name.45': 'Смелый Инвестор',
  'bot.name.46': 'Смелый Маклер',
  'bot.name.47': 'Смелый Магнат',
  'bot.name.48': 'Дотошный Риелтор',
  'bot.name.49': 'Дотошный Помещик',
  'bot.name.50': 'Дотошный Землемер',
  'bot.name.51': 'Дотошный Старатель',
  'bot.name.52': 'Дотошный Зодчий',
  'bot.name.53': 'Дотошный Инвестор',
  'bot.name.54': 'Дотошный Маклер',
  'bot.name.55': 'Дотошный Магнат',
  'bot.name.56': 'Зоркий Риелтор',
  'bot.name.57': 'Зоркий Помещик',
  'bot.name.58': 'Зоркий Землемер',
  'bot.name.59': 'Зоркий Старатель',
  'bot.name.60': 'Зоркий Зодчий',
  'bot.name.61': 'Зоркий Инвестор',
  'bot.name.62': 'Зоркий Маклер',
  'bot.name.63': 'Зоркий Магнат',
};

export default ru;
