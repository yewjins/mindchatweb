const app = document.querySelector('#app');
const toast = document.querySelector('#toast');
const storageKey = 'mindchat.maps.v1';
const example = { topic: 'My perfect weekend', keywords: ['Coffee with friends', 'A walk in the park', 'Reading a book', 'Sleeping in'] };
const loadError = '마인드맵을 불러오지 못했어요. 다시 시도해 주세요.';
let screen = 'home';
let draft = freshDraft();
let savedSnapshot = JSON.stringify(draft);
let selectedId;
let activeExample = -1;
let editing = -1;
let zoom = 1;
let timer;
let toastTimer;

function freshDraft() {
  return { topic: '', keywords: [], sentence: '', pendingKeyword: '' };
}

function html(value) {
  const escape = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value).replace(/[&<>"']/g, character => escape[character]);
}

function length(value) {
  return [...value.trim()].length;
}

function readMaps() {
  const raw = localStorage.getItem(storageKey);
  if (raw === null) return [];
  const maps = JSON.parse(raw);
  if (!Array.isArray(maps) || !maps.every(validRecord)) throw new Error('Invalid mind map data');
  return maps;
}

function validRecord(map) {
  return map && typeof map.id === 'string' && typeof map.topic === 'string' &&
    typeof map.sentence === 'string' && Number.isFinite(map.updatedAt) &&
    Array.isArray(map.keywords) && map.keywords.every(keyword => typeof keyword === 'string');
}

function graph(map, options = {}) {
  const { preview = false, highlighted = -1 } = options;
  const rows = Math.max(2, Math.ceil(map.keywords.length / 2));
  const height = Math.max(232, rows * 84 + 42);
  const center = height / 2;
  const nodes = map.keywords.map((keyword, index) => {
    const left = index % 2 === 0;
    return { keyword, index, x: left ? 8 : 374, y: 30 + Math.floor(index / 2) * (height - 60) / (rows - 1), left };
  });
  const lines = nodes.map(({ x, y, left }) => {
    const start = left ? 176 : 344;
    const end = left ? x + 138 : x;
    const bend = (start + end) / 2;
    return `<path d="M ${start} ${center} C ${bend} ${center}, ${bend} ${y}, ${end} ${y}"/>`;
  }).join('');
  const branches = nodes.map(({ keyword, index, x, y }) => `
    <rect x="${x}" y="${y - 28}" width="138" height="56" rx="24" fill="${highlighted === index ? '#bfdbfe' : '#e0f2fe'}" stroke="#bae6fd"/>
    <foreignObject x="${x}" y="${y - 27}" width="138" height="54"><div>${html(keyword)}</div></foreignObject>`).join('');
  return `<div class="graph"><svg class="diagram" role="img" aria-label="${html([map.topic || '중심 주제', ...map.keywords].join(' · '))}" viewBox="0 0 520 ${height}"${preview ? '' : ` style="width:${zoom * 100}%"`}>
    <g fill="none" stroke="#94a3b8" stroke-width="2">${lines}</g>
    <g font-size="13" font-weight="650" style="color:#075985">${branches}</g>
    <rect x="176" y="${center - 37}" width="168" height="74" rx="23" fill="#2563eb"/>
    <foreignObject x="176" y="${center - 37}" width="168" height="74" style="color:white" font-size="15" font-weight="750"><div>${html(map.topic || '중심 주제')}</div></foreignObject>
  </svg></div>`;
}

function chips(keywords, insert = false) {
  return `<div class="chips">${keywords.map(keyword => insert
    ? `<button class="chip" data-action="insert" data-value="${html(keyword)}">${html(keyword)}</button>`
    : `<span class="chip">${html(keyword)}</span>`).join('')}</div>`;
}

function displayDate(timestamp) {
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(timestamp);
}

function savedCards(recent = false) {
  try {
    const sorted = readMaps().sort((first, second) => second.updatedAt - first.updatedAt);
    const maps = recent ? sorted.slice(0, 3) : sorted;
    if (!maps.length) return `<div class="card empty"><p>아직 저장한 마인드맵이 없어요.</p><button data-action="new">첫 마인드맵 시작하기</button></div>`;
    return `<div class="saved-grid">${maps.map(map => `<article class="card saved-card">
      <span class="meta">${displayDate(map.updatedAt)} · 가지 ${map.keywords.length}개</span>
      <h3>${html(map.topic)}</h3>${chips(map.keywords.slice(0, 3))}
      <p class="preview-text" lang="en">${html(map.sentence)}</p>
      <div class="actions"><button data-action="view" data-id="${html(map.id)}">열기</button><button data-action="resume" data-id="${html(map.id)}">이어서 작성</button></div>
    </article>`).join('')}</div>`;
  } catch {
    return `<div class="card empty"><p class="error" role="alert">${loadError}</p><button class="primary" data-action="retry">다시 시도</button></div>`;
  }
}

function homeScreen() {
  return `<section class="hero">
    <div><span class="label">로그인 없이 바로 시작</span><h1>파트너 챗 준비</h1>
      <h2>키워드에서 시작하는 영어회화</h2><p>수업 주제를 마인드맵으로 정리하고, 키워드를 보며 파트너에게 전할 말을 영어로 써 보세요.</p>
      <div class="actions"><button class="primary" data-action="new">＋ 새 마인드맵 만들기</button><button data-action="library">저장한 마인드맵 열기</button></div>
    </div>
    <div><div class="field-head"><strong>마인드맵 예시</strong><span class="meta">키워드를 눌러 보세요</span></div>
      <div id="sample-graph">${graph(example, { preview: true, highlighted: activeExample })}</div>
      <div class="actions sample-controls">${example.keywords.map((keyword, index) => `<button class="chip" data-action="sample" data-index="${index}" aria-pressed="${index === activeExample}">${keyword}</button>`).join('')}</div>
    </div>
  </section>
  <section class="section"><h2>파트너 챗 준비 순서</h2><div class="steps">
    <article class="card"><span class="step-icon" aria-hidden="true">✦</span><div><h3>마인드맵 그리기</h3><p>수업 주제에서 떠오르는 생각을 가지로 붙여 보세요.</p></div></article>
    <article class="card"><span class="step-icon" aria-hidden="true">✎</span><div><h3>영어 문장 만들기</h3><p>키워드를 보며 파트너에게 전할 말을 써 보세요.</p></div></article>
    <article class="card"><span class="step-icon" aria-hidden="true">✓</span><div><h3>키워드로 대화하기</h3><p>저장한 마인드맵을 열고 키워드를 단서로 말해 보세요.</p></div></article>
  </div></section>
  <section class="section"><div class="section-head"><h2>최근 작업</h2><span class="meta">저장한 내용은 이 브라우저에 보관돼요.</span></div>${savedCards(true)}</section>`;
}

function counter(id, value, max) {
  return `<span class="counter" id="${id}">${length(value)} / ${max}</span>`;
}

function errorField(id) {
  return `<p class="error" id="${id}" aria-live="polite"></p>`;
}

function branchList() {
  return `<ul class="branch-list">${draft.keywords.map((keyword, index) => `<li>${editing === index
    ? `<input id="branch-edit" aria-label="키워드 수정" aria-describedby="branch-error" value="${html(keyword)}"><button class="primary" data-action="apply-branch" data-index="${index}">적용</button><button data-action="cancel-branch">취소</button>`
    : `<span>${html(keyword)}</span><button data-action="edit-branch" data-index="${index}" aria-label="${html(keyword)} 수정">수정</button><button data-action="delete-branch" data-index="${index}" aria-label="${html(keyword)} 삭제">삭제</button>`}</li>`).join('')}</ul>`;
}

function mapScreen() {
  return `<div class="section-head page-head"><div><h1>마인드맵 작성</h1><p>파트너 챗 주제를 중심으로 생각을 펼쳐 보세요.</p></div><button class="primary" data-action="compose">문장 정리하기</button></div>
  <div class="split"><div class="card">
    <div class="section-head"><h2>마인드맵</h2><span class="meta" id="branch-status">가지 ${draft.keywords.length}개</span></div>
    <div id="map-graph">${graph(draft)}</div>
    <div class="actions graph-tools" aria-label="마인드맵 확대 도구"><button data-action="zoom-out" aria-label="축소">−</button><button data-action="zoom-fit">화면 맞춤</button><button data-action="zoom-in" aria-label="확대">＋</button></div>
  </div><div class="flow"><div class="card">
    <div class="field-head"><label for="topic"><strong>중심 주제</strong></label>${counter('topic-count', draft.topic, 50)}</div>
    <input id="topic" placeholder="수업에서 받은 주제를 입력하세요" aria-describedby="topic-count topic-error" value="${html(draft.topic)}">${errorField('topic-error')}
  </div><div class="card flow">
    <form id="keyword-form"><div class="field-head"><label for="keyword"><strong>키워드 가지</strong></label>${counter('keyword-count', draft.pendingKeyword, 30)}</div>
    <div class="add-row"><input id="keyword" placeholder="떠오르는 키워드를 입력하세요" aria-describedby="keyword-count keyword-error" value="${html(draft.pendingKeyword)}"><button type="submit">＋ 가지 추가</button></div>${errorField('keyword-error')}</form>
    <div id="branches">${branchList()}</div>${errorField('branch-error')}
  </div><div class="actions"><button class="primary" data-action="compose">문장 정리하기</button></div></div></div>`;
}

function sentenceScreen() {
  return `<div class="page-head"><h1>문장 정리</h1></div><div class="split">
    <aside class="flow"><section class="card flow"><div><h2>내가 정리한 키워드</h2><p>키워드를 누르면 문장 끝에 추가됩니다.</p></div>
      <div>${graph(draft, { preview: true })}</div>${chips(draft.keywords, true)}</section>
      <section class="card tip"><h3>말하기 연습</h3><p>30~45초 동안 키워드를 보며 영어로 말해 보세요.</p><div class="actions section-head"><button data-action="timer">연습 시작</button><span id="timer" class="meta" role="timer">00:45</span></div></section>
    </aside><section class="card flow"><h2><label for="sentence">키워드를 보고 영어로 말할 내용을 써 보세요</label></h2>
      <div><textarea id="sentence" lang="en" placeholder="I usually…" aria-describedby="sentence-count sentence-error">${html(draft.sentence)}</textarea>
      <div class="field-head"><span></span>${counter('sentence-count', draft.sentence, 500)}</div>${errorField('sentence-error')}</div>
      <div class="actions"><button class="chip" data-action="insert" data-value="In addition,">＋ In addition</button><button class="chip" data-action="insert" data-value="What I loved most">＋ What I loved most</button><button data-action="clear">지우기</button></div>
      <div class="actions editor-actions"><button data-action="edit">마인드맵 수정하기</button><button class="primary" data-action="save">문장 저장</button></div><p class="success" id="save-status" role="status"></p>
    </section></div>`;
}

function savedScreen(focused = false) {
  try {
    const map = readMaps().find(item => item.id === selectedId);
    if (!map) throw new Error('Missing map');
    if (focused) return `<section class="card flow focus-mode"><div class="section-head"><h1>${html(map.topic)}</h1><button data-action="view" data-id="${html(map.id)}">몰입 뷰 닫기</button></div>${graph(map, { preview: true })}</section>`;
    return `<section class="section-head page-head"><div><span class="label">파트너 챗 실전 모드</span><h1>${html(map.topic)}</h1><p>추천 발화 시간 1분 30초 ~ 2분</p></div>
    <div class="actions"><button data-action="focus-map">키워드 몰입 뷰</button><button data-action="resume" data-id="${html(map.id)}">수정하기</button></div></section>
    <div class="split"><section class="card"><h2>키워드 마인드맵</h2>${graph(map, { preview: true })}<p lang="en">What comes to mind when you think about this topic?</p></section>
    <div class="flow"><section class="card"><div class="section-head"><h2>작성한 문장</h2><button data-action="toggle-script" aria-expanded="false" aria-controls="script">문장 보기</button></div><p class="script" id="script" lang="en" hidden>${html(map.sentence)}</p></section>
    <section class="card tip"><h2>실전 체크리스트</h2><div class="checklist"><label><input type="checkbox"> 아이컨택 유지하기</label><label><input type="checkbox"> 키워드를 보며 내 말로 이어가기</label><label><input type="checkbox"> 파트너의 답변에 반응하기</label></div></section>
    <div class="actions"><button data-action="library">목록으로 돌아가기</button><button data-action="new">＋ 새 주제 추가하기</button></div></div></div>`;
  } catch {
    return `<section class="card flow"><h1>저장한 마인드맵</h1><p class="error" role="alert">저장한 내용을 열 수 없어요.</p><div class="actions"><button class="primary" data-action="retry">다시 시도</button><button data-action="library">목록으로 돌아가기</button></div></section>`;
  }
}

function render() {
  const screens = {
    home: homeScreen, map: mapScreen, sentence: sentenceScreen,
    library: () => `<div class="section-head page-head"><div><h1>저장된 마인드맵</h1><p>저장한 주제를 열어 파트너 챗을 연습해 보세요.</p></div><button class="primary" data-action="new">＋ 새 마인드맵 만들기</button></div>${savedCards()}`,
    view: savedScreen, focus: () => savedScreen(true)
  };
  app.innerHTML = screens[screen]();
  const currentTab = { sentence: 'map', view: 'library', focus: 'library' }[screen] || screen;
  document.querySelectorAll('[data-tab]').forEach(tab => {
    if (tab.dataset.tab === currentTab) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  });
  if (screen === 'sentence') updateCounter('sentence', draft.sentence, 500);
}

function navigate(next, focusId) {
  clearInterval(timer);
  timer = undefined;
  screen = next;
  editing = -1;
  zoom = 1;
  render();
  window.scrollTo(0, 0);
  const target = document.getElementById(focusId) || app.querySelector('h1');
  if (target) {
    if (target.matches('h1')) target.tabIndex = -1;
    target.focus({ preventScroll: true });
  }
}

function updateCounter(field, value, max) {
  const output = document.getElementById(`${field}-count`);
  const count = length(value);
  output.textContent = `${count} / ${max}`;
  output.classList.toggle('over', count > max);
  output.classList.toggle('warn', max === 500 && count > 480 && count <= max);
}

function error(field, message, focus = false) {
  document.getElementById(`${field}-error`).textContent = message;
  const input = document.getElementById(field === 'branch' ? 'branch-edit' : field);
  if (input) {
    input.toggleAttribute('aria-invalid', Boolean(message));
    if (focus) input.focus();
  }
}

function validTopic() {
  const count = length(draft.topic);
  if (!count) return '주제를 입력해 주세요.';
  return count > 50 ? '주제는 50자 이내로 입력해 주세요.' : '';
}

function keywordError(value) {
  return length(value) >= 1 && length(value) <= 30 ? '' : '키워드는 1~30자로 입력해 주세요.';
}

function updateBranches() {
  document.getElementById('branches').innerHTML = branchList();
  document.getElementById('branch-status').textContent = `가지 ${draft.keywords.length}개`;
  document.getElementById('map-graph').innerHTML = graph(draft);
  error('branch', '');
}

function updateSentence(value) {
  draft.sentence = value;
  document.getElementById('sentence').value = value;
  document.getElementById('save-status').textContent = '';
  updateCounter('sentence', value, 500);
  error('sentence', length(value) > 500 ? '문장은 500자 이내로 입력해 주세요.' : '');
}

function save() {
  const count = length(draft.sentence);
  if (!count || count > 500) {
    error('sentence', count ? '문장은 500자 이내로 입력해 주세요.' : '영어 문장을 입력해 주세요.', true);
    return;
  }
  try {
    const record = { id: draft.id || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`, topic: draft.topic.trim(), keywords: [...draft.keywords], sentence: draft.sentence.trim(), updatedAt: Date.now() };
    const maps = readMaps().filter(map => map.id !== record.id);
    localStorage.setItem(storageKey, JSON.stringify([record, ...maps]));
    draft.id = record.id;
    savedSnapshot = JSON.stringify({ ...draft, pendingKeyword: '' });
    error('sentence', '');
    document.getElementById('save-status').textContent = '✓ 저장했어요.';
    clearTimeout(toastTimer);
    toast.textContent = '마인드맵을 저장했어요.';
    toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2500);
  } catch {
    error('sentence', '저장하지 못했어요. 문장 저장을 다시 눌러 주세요.');
  }
}

function openRecord(id, resume) {
  if (resume && !canReplaceDraft()) return;
  selectedId = id;
  if (resume) {
    try {
      const record = readMaps().find(map => map.id === id);
      if (!record) throw new Error('Missing map');
      draft = { ...record, pendingKeyword: '' };
      savedSnapshot = JSON.stringify(draft);
      navigate('map', 'topic');
      return;
    } catch {
      // The saved view supplies the retry action when the record is unavailable.
    }
  }
  navigate('view');
}

function canReplaceDraft() {
  return JSON.stringify(draft) === savedSnapshot ||
    confirm('현재 작업의 저장하지 않은 변경 내용이 사라집니다. 계속할까요?');
}

function applyBranch(index) {
  const value = document.getElementById('branch-edit').value;
  const message = keywordError(value);
  if (message) return error('branch', message, true);
  draft.keywords[index] = value.trim();
  editing = -1;
  updateBranches();
  document.querySelector(`[data-action="edit-branch"][data-index="${index}"]`).focus();
}

function practice(button) {
  const output = document.getElementById('timer');
  if (timer) {
    clearInterval(timer);
    timer = undefined;
    button.textContent = '연습 시작';
    output.textContent = '00:45';
    return;
  }
  const end = Date.now() + 45000;
  button.textContent = '연습 중지';
  output.textContent = '00:45';
  timer = setInterval(() => {
    const seconds = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    output.textContent = `00:${String(seconds).padStart(2, '0')}`;
    if (seconds === 0) {
      clearInterval(timer);
      timer = undefined;
      button.textContent = '다시 연습하기';
    }
  }, 250);
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { action, id, value } = button.dataset;
  const index = Number(button.dataset.index);
  switch (action) {
    case 'home': case 'library': navigate(action); break;
    case 'retry': render(); break;
    case 'new':
      if (!canReplaceDraft()) break;
      draft = freshDraft();
      savedSnapshot = JSON.stringify(draft);
      navigate('map', 'topic');
      break;
    case 'edit': navigate('map', 'topic'); break;
    case 'sample':
      activeExample = activeExample === index ? -1 : index;
      document.getElementById('sample-graph').innerHTML = graph(example, { preview: true, highlighted: activeExample });
      document.querySelectorAll('[data-action="sample"]').forEach(item => item.setAttribute('aria-pressed', String(Number(item.dataset.index) === activeExample)));
      break;
    case 'edit-branch':
      editing = index;
      updateBranches();
      document.getElementById('branch-edit').select();
      break;
    case 'apply-branch': applyBranch(index); break;
    case 'cancel-branch': editing = -1; updateBranches(); document.getElementById('keyword').focus(); break;
    case 'delete-branch':
      draft.keywords.splice(index, 1);
      editing = -1;
      updateBranches();
      document.getElementById('keyword').focus();
      break;
    case 'zoom-in': case 'zoom-out': case 'zoom-fit':
      zoom = action === 'zoom-fit' ? 1 : Math.min(2.5, Math.max(0.6, zoom + (action === 'zoom-in' ? 0.2 : -0.2)));
      document.getElementById('map-graph').innerHTML = graph(draft);
      break;
    case 'compose': {
      const message = validTopic();
      error('topic', message, Boolean(message));
      if (message) break;
      if (!draft.keywords.length) return error('keyword', '키워드를 하나 이상 추가해 주세요.', true);
      navigate('sentence', 'sentence');
      break;
    }
    case 'insert': updateSentence(`${draft.sentence}${draft.sentence && !/\s$/.test(draft.sentence) ? ' ' : ''}${value}`); document.getElementById('sentence').focus(); break;
    case 'clear':
      if (draft.sentence && confirm('작성 중인 문장을 지울까요?')) updateSentence('');
      document.getElementById('sentence').focus();
      break;
    case 'save': save(); break;
    case 'resume': case 'view': openRecord(id, action === 'resume'); break;
    case 'focus-map': navigate('focus'); break;
    case 'toggle-script': {
      const script = document.getElementById('script');
      script.hidden = !script.hidden;
      button.setAttribute('aria-expanded', String(!script.hidden));
      button.textContent = script.hidden ? '문장 보기' : '문장 접기';
      break;
    }
    case 'timer': practice(button); break;
  }
});

app.addEventListener('input', event => {
  const { id, value } = event.target;
  if (id === 'topic') {
    draft.topic = value;
    updateCounter(id, value, 50);
    error(id, length(value) > 50 ? validTopic() : '');
    document.getElementById('map-graph').innerHTML = graph({ ...draft, topic: value.trim() });
  } else if (id === 'keyword') {
    draft.pendingKeyword = value;
    updateCounter(id, value, 30);
    error(id, length(value) > 30 ? keywordError(value) : '');
  } else if (id === 'sentence') {
    updateSentence(value);
  }
});

app.addEventListener('submit', event => {
  if (event.target.id !== 'keyword-form') return;
  event.preventDefault();
  const value = draft.pendingKeyword;
  const message = keywordError(value);
  if (message) return error('keyword', message, true);
  draft.keywords.push(value.trim());
  draft.pendingKeyword = '';
  const input = document.getElementById('keyword');
  input.value = '';
  updateCounter('keyword', '', 30);
  error('keyword', '');
  updateBranches();
  input.focus();
});

app.addEventListener('keydown', event => {
  if (event.target.id !== 'branch-edit' || event.isComposing) return;
  if (event.key === 'Enter') {
    event.preventDefault();
    applyBranch(editing);
  }
  if (event.key === 'Escape') document.querySelector('[data-action="cancel-branch"]').click();
});

render();
