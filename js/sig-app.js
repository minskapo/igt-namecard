(function () {
  const $ = (s) => document.querySelector(s);
  const C = window.CardData, S = window.SigCore, R = window.SigRender;
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const state = { people: [], activeId: null, seq: 0, wb: null, lang: 'kr' };
  const byId = (id) => state.people.find((p) => p.id === id);
  const status = (msg, err) => { const el = $('#status'); el.textContent = msg || ''; el.style.color = err ? '#b42318' : ''; };
  R.load().catch((e) => status('서명 재료를 불러오지 못했습니다: ' + e.message, true));

  /* ---------- 1. DB ---------- */
  const drop = $('#drop');
  $('#file').addEventListener('change', (e) => e.target.files[0] && readFile(e.target.files[0]));
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => e.dataTransfer.files[0] && readFile(e.dataTransfer.files[0]));

  async function readFile(f) {
    try {
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
      const name = wb.SheetNames.includes('구성원') ? '구성원' : wb.SheetNames[0];
      loadRows(XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: false }));
      drop.querySelector('strong').textContent = f.name;
    } catch (err) { status('파일을 읽지 못했습니다: ' + err.message, true); }
  }
  // DB 불러오기 결과는 버튼 바로 아래에 보여 준다(④의 상태줄은 화면 밖에 있을 수 있음).
  const dbNote = (msg, err) => { const el = $('#dbLoadNote'); el.textContent = msg; el.style.color = err ? '#b42318' : ''; };
  if (!DBLoad.ready()) dbNote('Google 로그인 연결 설정 전이라 아직 쓸 수 없습니다. 지금은 아래처럼 DB를 .xlsx로 받아 끌어다 놓아 주세요.', true);
  $('#dbLoad').addEventListener('click', async () => {
    const b = $('#dbLoad');
    if (!DBLoad.ready()) { dbNote('아직 Google 로그인 연결(클라이언트 ID)이 설정되지 않았습니다. 관리자가 메일 서명 페이지의 ‘DB 바로 불러오기 설정’을 마치면 쓸 수 있습니다. 지금은 아래 파일 불러오기를 써 주세요.', true); return; }
    b.disabled = true; dbNote('구성원 DB를 불러오는 중…');
    try { loadRows(await DBLoad.fetchRows()); dbNote('구성원 DB 시트에서 불러왔습니다. 시트를 고친 뒤 다시 누르면 새 내용이 반영됩니다.'); }
    catch (err) { dbNote(err.message, true); }
    finally { b.disabled = false; }
  });
  function loadRows(rows) {
    {
      const fresh = C.rowsToPeople(rows).map((p) => ({ ...p, id: ++state.seq, selected: false, codeNew: false }));
      state.people = state.people.filter((p) => p.isNew).concat(fresh);
      state.activeId = null;
      const noCode = fresh.filter((p) => !S.validCode(p.sigCode)).length;
      status(`${fresh.length}명을 불러왔습니다.` + (fresh[0] && !fresh[0].fromDb ? ' 이 파일에는 ‘서명 코드’ 열이 없어 모두 새 코드가 만들어집니다. 구성원 DB 파일을 쓰는 것이 좋습니다.' : noCode ? ` 서명 코드가 없는 ${noCode}명은 내려받을 때 새 코드가 만들어집니다.` : ''));
      renderList(); renderForm(); preview();
    }
  }

  /* ---------- 2. 목록 ---------- */
  $('#q').addEventListener('input', renderList);
  $('#addNew').addEventListener('click', () => {
    const p = { ...C.makePerson({ name: '', dept: '기후시민팀', title: '연구원', mobile: '', email: '' }), id: ++state.seq, selected: true, isNew: true, sigLang: 'kr', sigCode: '', codeNew: false };
    state.people.unshift(p); state.activeId = p.id;
    renderList(); renderForm(); preview();
    $('#fields [name=name]').focus();
  });
  $('#selAll').addEventListener('click', () => { visible().forEach((p) => (p.selected = true)); renderList(); });
  $('#selNone').addEventListener('click', () => { state.people.forEach((p) => (p.selected = false)); renderList(); });
  const visible = () => {
    const q = $('#q').value.trim().toLowerCase();
    return state.people.filter((p) => !q || (p.name + ' ' + p.nameEn + ' ' + p.email).toLowerCase().includes(q));
  };
  function renderList() {
    const list = $('#list'), ps = visible();
    if (!state.people.length) { list.innerHTML = '<p class="empty">DB를 불러오거나 ‘직접 입력’을 눌러 주세요.</p>'; updateCount(); return; }
    let html = '', last = null;
    ps.forEach((p) => {
      const grp = p.isNew ? '직접 입력' : (['이사장', '소장', '부소장'].includes(p.dept) ? '임원' : p.dept || '기타');
      if (grp !== last) { html += `<div class="grp">${esc(grp)}</div>`; last = grp; }
      const bad = S.problems(p).length;
      html += `<div class="item${p.id === state.activeId ? ' active' : ''}" data-id="${p.id}">
        <input type="checkbox" aria-label="${esc(p.name || '이름 없음')} 선택" ${p.selected ? 'checked' : ''}>
        <span class="nm">${esc(p.name || '(이름 입력)')}</span>${bad ? '<span class="flag">확인 필요</span>' : ''}${!S.validCode(p.sigCode) || p.codeNew ? '<span class="new">새 코드</span>' : ''}
        <span class="tt">${esc(p.titleKr)}<br><span class="code">${esc(S.idOf(p))}</span></span></div>`;
    });
    list.innerHTML = html || '<p class="empty">검색 결과가 없습니다.</p>';
    updateCount();
  }
  $('#list').addEventListener('click', (e) => {
    const it = e.target.closest('.item'); if (!it) return;
    const p = byId(+it.dataset.id);
    if (e.target.matches('input[type=checkbox]')) { p.selected = e.target.checked; updateCount(); return; }
    state.activeId = p.id;
    if (!state.people.some((x) => x.selected)) p.selected = true;
    renderList(); renderForm(); preview();
  });
  function updateCount() {
    const n = state.people.filter((p) => p.selected).length;
    $('#count').textContent = n ? `${n}명 선택됨` : '';
    $('#dlZip').disabled = !n; $('#copyRows').disabled = !n;
    $('#dlZip').textContent = n ? `배포 파일 ZIP (${n}명)` : '배포 파일 ZIP';
  }

  /* ---------- 3. 편집 ---------- */
  const form = $('#form');
  const KEYS = ['name', 'nameEn', 'titleKr', 'titleEn', 'mobile', 'email', 'sigLang', 'sigCode'];
  function renderForm() {
    const p = byId(state.activeId);
    $('#fields').hidden = !p; $('#formEmpty').hidden = !!p;
    if (!p) return;
    KEYS.forEach((k) => (form.elements[k].value = p[k] || (k === 'sigLang' ? 'kr' : '')));
  }
  form.addEventListener('input', (e) => {
    const p = byId(state.activeId); if (!p) return;
    const k = e.target.name; if (!KEYS.includes(k)) return;
    p[k] = e.target.value;
    if (k === 'name' && p.isNew) { p.nameEn = C.romanizeName(p.name); form.elements.nameEn.value = p.nameEn; }
    if (k === 'name' || k === 'titleKr' || k === 'email') renderList();
    schedulePreview();
  });
  form.addEventListener('change', (e) => {
    const p = byId(state.activeId); if (!p) return;
    if (e.target.name === 'email') { p.email = e.target.value.trim(); e.target.value = p.email; renderList(); schedulePreview(); }
  });
  form.addEventListener('submit', (e) => e.preventDefault());
  $('#newCode').addEventListener('click', () => {
    const p = byId(state.activeId); if (!p) return;
    if (S.validCode(p.sigCode) && !confirmNew()) return;
    p.sigCode = S.newCode(); p.codeNew = true; form.elements.sigCode.value = p.sigCode; renderList(); preview();
  });
  // 기존 코드를 바꾸면 예전 서명 이미지 주소가 끊긴다는 점을 화면에서 알린다(브라우저 대화상자 대신).
  let confirmArmed = false;
  function confirmNew() {
    if (confirmArmed) { confirmArmed = false; return true; }
    confirmArmed = true;
    status('이미 코드가 있습니다. 코드를 바꾸면 예전 서명의 이미지가 끊깁니다. 정말 바꾸려면 ‘새로 만들기’를 한 번 더 누르세요.', true);
    setTimeout(() => (confirmArmed = false), 6000);
    return false;
  }
  const ensureCode = (p) => { if (!S.validCode(p.sigCode)) { p.sigCode = S.newCode(); p.codeNew = true; } return p.sigCode; };

  /* ---------- 4. 미리보기 ---------- */
  document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => {
    state.lang = b.dataset.lang;
    document.querySelectorAll('.tab').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    preview();
  }));
  let timer = null, ticket = 0, lastUrls = [];
  const schedulePreview = () => { clearTimeout(timer); timer = setTimeout(preview, 250); };
  async function preview() {
    const p = byId(state.activeId), my = ++ticket, lang = state.lang;
    ['#copySig', '#dlHtml', '#dlPng', '#copyText'].forEach((k) => ($(k).disabled = !p));
    if (!p) { $('#sigPreview').innerHTML = '<p class="empty">구성원을 고르면 서명이 여기에 보입니다.</p>'; $('#warn').hidden = true; $('#hostState').textContent = ''; return; }
    try {
      const A = await R.load();
      const r = await R.top(p, lang), warn = r.warn;
      if (my !== ticket) return;
      const pc = R.parts(r), urls = {};
      for (const k of S.PARTS) urls[k] = URL.createObjectURL(await R.toBlob(pc[k].canvas));
      if (my !== ticket) { Object.values(urls).forEach(URL.revokeObjectURL); return; }
      lastUrls.forEach(URL.revokeObjectURL); lastUrls = Object.values(urls);
      $('#sigPreview').innerHTML = S.html({ ...p, sigCode: p.sigCode || 'preview' }, lang, A.layout, r.geom, {
        part: (k) => urls[k], common: (f) => `assets/email/sig/common/${lang}/${f}?v=${S.COMMON_VER}`
      });
      const miss = S.problems(p);
      const items = (miss.length ? [`비어 있거나 형식이 맞지 않는 값: ${miss.join(', ')}`] : []).concat(warn);
      $('#warn').innerHTML = items.map((x) => `<li>${esc(x)}</li>`).join('');
      $('#warn').hidden = !items.length;
      checkHosted(p, lang, my);
    } catch (err) { status('미리보기를 만들지 못했습니다: ' + err.message, true); }
  }
  // 저장소에 이미지가 올라가 있는지(서명 복사가 바로 쓸 수 있는지) 확인
  function checkHosted(p, lang, my) {
    const el = $('#hostState');
    el.className = 'muted';
    if (!S.validCode(p.sigCode) || p.codeNew) { el.className = 'muted no'; el.textContent = '서명 코드가 새로 만들어졌습니다. 배포 파일을 받아 저장소에 올린 뒤에 서명 복사를 쓸 수 있습니다.'; return; }
    el.textContent = '저장소의 서명 이미지를 확인하는 중…';
    const img = new Image();
    img.onload = () => { if (my === ticket) { el.className = 'muted ok'; el.textContent = '이미지 준비됨: 서명 복사로 바로 붙여 넣을 수 있습니다.'; } };
    img.onerror = () => { if (my === ticket) { el.className = 'muted no'; el.textContent = '이미지 준비 안 됨: 이 내용의 서명 이미지가 아직 저장소에 없습니다. 배포 파일 ZIP을 받아 저장소에 올려 주세요.'; } };
    img.src = S.topUrl(p, lang);
  }

  /* ---------- 복사·내려받기 ---------- */
  async function layout() { return (await R.load()).layout; }
  // 연락처 칸 경계는 글자 폭에 따라 사람마다 달라서, HTML을 만들 때마다 윗부분을 다시 계산한다.
  async function sigHtml(p, lang) { const L = await layout(); const r = await R.top(p, lang); return S.html(p, lang, L, r.geom); }
  const active = () => byId(state.activeId);
  const docOf = (body, title) => `<!doctype html>\n<html lang="ko"><head><meta charset="utf-8"><title>${esc(title)}</title></head>\n<body style="margin:24px;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;">\n<!-- 서명 시작: 아래 표 전체를 복사해 메일 프로그램의 서명 칸에 붙여 넣습니다 -->\n${body}\n<!-- 서명 끝 -->\n</body></html>\n`;
  function save(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const fileBase = (p, lang) => `메일서명_${p.name || S.idOf(p)}_${lang === 'en' ? '영문' : '국문'}`;

  $('#copySig').addEventListener('click', async () => {
    const p = active(); if (!p) return;
    const html = await sigHtml(p, state.lang);
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([S.plain(p, state.lang)], { type: 'text/plain' })
      })]);
      status('서명을 복사했습니다. 메일 프로그램의 서명 칸에 붙여 넣으세요.');
    } catch (err) { status('복사하지 못했습니다. ‘HTML 내려받기’로 받은 파일을 브라우저로 열어 서명을 복사해 주세요.', true); }
  });
  $('#copyText').addEventListener('click', async () => {
    const p = active(); if (!p) return;
    try { await navigator.clipboard.writeText(S.plain(p, state.lang)); status('글자 서명을 복사했습니다.'); }
    catch (err) { status('복사하지 못했습니다: ' + err.message, true); }
  });
  $('#dlHtml').addEventListener('click', async () => {
    const p = active(); if (!p) return;
    ensureCode(p); renderForm(); renderList();
    save(new Blob([docOf(await sigHtml(p, state.lang), fileBase(p, state.lang))], { type: 'text/html' }), fileBase(p, state.lang) + '.html');
    if (p.codeNew) status('새 서명 코드가 만들어졌습니다. 이미지를 저장소에 올리고 DB에 코드를 적어야 HTML의 이미지가 보입니다.');
  });
  $('#dlPng').addEventListener('click', async () => {
    const p = active(); if (!p) return;
    const A = await R.load(), lang = state.lang, L = A.layout[lang];
    const { canvas } = await R.top(p, lang);
    // 윗부분 + 공통 조각을 합친 한 장짜리 이미지
    const full = document.createElement('canvas'); full.width = L.W * L.scale; full.height = L.H * L.scale;
    const ctx = full.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(canvas, 0, 0, L.W * L.scale, L.top * L.scale);
    let x = 0;
    for (const c of L.cells) { const im = await loadImg(`assets/email/sig/common/${lang}/${c.f}?v=${S.COMMON_VER}`); ctx.drawImage(im, x * L.scale, L.top * L.scale); x += c.w; }
    ctx.drawImage(await loadImg(`assets/email/sig/common/${lang}/bot.png?v=${S.COMMON_VER}`), 0, L.bot * L.scale);
    save(await R.toBlob(full), fileBase(p, lang) + '.png');
  });
  const loadImg = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error(src)); i.src = src; });

  /* ---------- 배포 파일 ZIP ---------- */
  $('#dlZip').addEventListener('click', async () => {
    const sel = state.people.filter((p) => p.selected);
    if (!sel.length) return;
    const bad = sel.filter((p) => S.problems(p).length);
    if (bad.length) { status(`확인이 필요한 사람이 있습니다: ${bad.map((p) => p.name || '(이름 없음)').join(', ')}. 내용을 채운 뒤 다시 눌러 주세요.`, true); return; }
    const dup = dupIds(sel);
    if (dup.length) { status('이메일 아이디가 겹칩니다: ' + dup.join(', '), true); return; }
    $('#dlZip').disabled = true;
    try {
      const L = await layout(), zip = new JSZip();
      const repo = zip.folder('저장소에_올릴_파일');
      const csv = [['email', 'file', 'name', 'lang']], codes = [['이메일 아이디', '이름', '서명 코드']], urls = [];
      let i = 0;
      for (const p of sel) {
        status(`서명 이미지를 만드는 중… (${++i}/${sel.length}) ${p.name}`);
        ensureCode(p);
        if (p.codeNew) codes.push([S.idOf(p), p.name, p.sigCode]);
        const htmlBy = {};
        for (const lang of ['kr', 'en']) {
          const r = await R.top(p, lang), pc = R.parts(r);
          for (const k of S.PARTS) repo.file(`assets/email/sig/${p.sigCode}/${lang}_${k}.png`, await R.toBlob(pc[k].canvas));
          htmlBy[lang] = S.html(p, lang, L, r.geom);
          zip.file(`사람별_HTML/${fileBase(p, lang)}.html`, docOf(htmlBy[lang], fileBase(p, lang)));
          zip.file(`사람별_HTML/${fileBase(p, lang)}.txt`, S.plain(p, lang) + '\n');
          urls.push(`${p.name}\t${lang}\t${S.topUrl(p, lang)}`);
        }
        const lang = p.sigLang === 'en' ? 'en' : 'kr', id = S.idOf(p);
        zip.file(`gam/html/${id}.html`, htmlBy[lang]);
        csv.push([p.email.trim(), `gam/html/${id}.html`, p.name, lang]);
      }
      const toCsv = (rows) => '﻿' + rows.map((r) => r.map((c) => /[",\n]/.test(c) ? `"${String(c).replace(/"/g, '""')}"` : c).join(',')).join('\r\n') + '\r\n';
      zip.file('gam/signatures.csv', rows2csv(csv));
      zip.file('이미지_주소_확인.txt', urls.join('\n') + '\n');
      if (codes.length > 1) zip.file('서명코드_DB기록.csv', toCsv(codes));
      zip.file('추적링크_시트행.tsv', tsvRows(sel));
      zip.file('읽어주세요.txt', readme(sel, codes.length - 1));
      const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      save(await zip.generateAsync({ type: 'blob' }), `메일서명_배포파일_${stamp}_${sel.length}명.zip`);
      renderList(); renderForm(); preview();
      status(`${sel.length}명의 배포 파일을 만들었습니다.` + (codes.length > 1 ? ` 새 서명 코드 ${codes.length - 1}개는 ZIP 안 ‘서명코드_DB기록.csv’대로 DB에 적어 주세요.` : ''));
    } catch (err) { status('배포 파일을 만들지 못했습니다: ' + err.message, true); }
    finally { updateCount(); }
  });
  const tsvRows = (ps) => ps.flatMap((p) => S.sheetRows(p)).map((r) => r.join('\t')).join('\n') + '\n';
  $('#copyRows').addEventListener('click', async () => {
    const sel = state.people.filter((p) => p.selected);
    if (!sel.length) return;
    try { await navigator.clipboard.writeText(tsvRows(sel)); status(`${sel.length}명 × 5줄을 복사했습니다. 추적링크 시트 ‘UTM코드 생성기’ 탭 맨 아래 빈 행의 A열에 붙여 넣으세요.`); }
    catch (err) { status('복사하지 못했습니다: ' + err.message, true); }
  });
  // GAM용 CSV는 BOM 없이 UTF-8로 쓴다.
  const rows2csv = (rows) => rows.map((r) => r.map((c) => /[",\n]/.test(c) ? `"${String(c).replace(/"/g, '""')}"` : c).join(',')).join('\n') + '\n';
  function dupIds(ps) {
    const seen = new Map();
    ps.forEach((p) => seen.set(S.idOf(p), (seen.get(S.idOf(p)) || 0) + 1));
    return [...seen].filter(([, n]) => n > 1).map(([k]) => k);
  }
  function readme(sel, nNew) {
    const one = sel[0];
    return [
      '녹색전환연구소 메일 서명 배포 파일',
      `만든 날: ${new Date().toLocaleString('ko-KR')} / ${sel.length}명`,
      '',
      '1) 이미지 올리기',
      "   '저장소에_올릴_파일' 안의 assets 폴더를 igt-namecard 저장소 맨 위에 그대로 덮어쓰고 커밋·push 합니다.",
      '   예) cp -R 저장소에_올릴_파일/assets ~/dev/igt-namecard/web/ && cd ~/dev/igt-namecard/web && git add assets/email/sig && git commit -m "메일 서명 이미지 갱신" && git push',
      "   1~2분 뒤 '이미지_주소_확인.txt'의 주소를 하나 열어 이미지가 보이는지 확인합니다.",
      '',
      '2) 관리자 일괄 적용 (GAM, 이 폴더에서 실행)',
      '   gam csv gam/signatures.csv gam user ~email signature file ~file html',
      '',
      '   한 사람만:',
      `   gam user ${one.email.trim()} signature file gam/html/${S.idOf(one)}.html html`,
      '',
      '   확인:',
      `   gam user ${one.email.trim()} show signature`,
      '',
      "3) 직접 넣을 때: '사람별_HTML' 폴더의 .html 파일을 브라우저로 열어 서명을 복사해 메일 프로그램 서명 칸에 붙여 넣습니다.",
      "   이미지를 쓸 수 없는 곳에는 같은 이름의 .txt(글자 서명)를 씁니다.",
      nNew ? `\n4) 새 서명 코드 ${nNew}개: '서명코드_DB기록.csv'의 코드를 DB 시트 '서명 코드' 칸에 옮겨 적습니다. 적지 않으면 다음에 새 코드가 만들어져 이미지 주소가 바뀝니다.` : '',
      '',
      '자세한 안내: https://minskapo.github.io/igt-namecard/signature.html'
    ].join('\n') + '\n';
  }
})();
