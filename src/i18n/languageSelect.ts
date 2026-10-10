/**
 * 언어 선택 UI.
 *
 * ★ 왜 눈에 잘 띄는 곳에 두는가
 *   스토어 패키지는 EN-US 한 언어만 선언한다(PWABuilder 가 MSIX 다국어를
 *   지원하지 않음). 즉 **설치된 앱에서 9개 언어를 실제로 전달하는 경로는
 *   이 셀렉터 하나뿐이다.** OS 가 영어인데 한국어로 하고 싶은 사용자가
 *   못 찾으면 그 언어는 없는 것과 같다.
 *   그래서 일시정지 시트뿐 아니라 **결과 화면**에도 붙인다 — 60초 한 판이
 *   끝나면 누구나 보게 되는 화면이라 첫 판에서 발견된다.
 *
 * ★ 옵션 이름은 번역 키가 아니라 엔도님(그 언어로 쓴 그 언어 이름)이다.
 *   'Korean' 이 아니라 '한국어'. UI 를 못 읽는 사용자가 자기 언어를 알아볼 수
 *   있어야 한다. Intl.DisplayNames 가 코드에서 만들어 내므로 언어를 늘려도
 *   번역할 목록이 생기지 않는다.
 */
import { LOCALES, activeLocale, localeLabel, onLocaleChange, setLocalePersisted, t } from './index';

let seq = 0;

/** 라벨 + 셀렉트 한 덩어리를 만든다. 부모가 원하는 곳에 append 하면 된다. */
export function createLanguageSelect(): HTMLElement {
  const id = `tc-lang-${++seq}`;

  const wrap = document.createElement('div');
  wrap.className = 'tc-lang';

  const label = document.createElement('label');
  label.className = 'tc-lang-label';
  label.htmlFor = id;
  label.textContent = t('settings.language');

  const select = document.createElement('select');
  select.className = 'tc-lang-select';
  select.id = id;

  for (const code of LOCALES) {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = localeLabel(code);
    if (code === activeLocale()) opt.selected = true;
    select.appendChild(opt);
  }

  select.addEventListener('change', () => {
    const next = LOCALES.find((l) => l === select.value);
    if (next) void setLocalePersisted(next);
  });

  // 언어가 바뀌면 라벨만 새 언어로 갱신한다(옵션은 엔도님이라 그대로 둔다).
  // 엘리먼트가 문서에서 떨어지면 스스로 구독을 해제한다 — 누수 방지.
  const off = onLocaleChange(() => {
    if (!wrap.isConnected) {
      off();
      return;
    }
    label.textContent = t('settings.language');
    select.value = activeLocale();
  });

  wrap.append(label, select);
  return wrap;
}
