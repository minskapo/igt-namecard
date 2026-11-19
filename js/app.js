(function () {
  const $ = (s) => document.querySelector(s);
  const C = window.CardData;
  const LK = window.CardLink;
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
  const pdfWorker = new pdfjsLib.PDFWorker();

  const state = { people: [], activeId: null, seq: 0, wb: null };
  let assets = null;
  const loadAssets = () => assets || (assets = Promise.all([
    fetch('assets/base.pdf?v=20261119a').then((r) => r.arrayBuffer()),
    fetch('assets/AstaSans-SemiBold.ttf?v=20261109').then((r) => r.arrayBuffer())
  ]).then(([base, font]) => ({ base, font })));
  loadAssets();

  const DEPTS = ['이사장', '소장', '부소장', ...Object.keys(C.TEAM_EN)];
  const TITLES = ['이사장', '소장', '부소장', '팀장', '선임연구원', '연구원', '인턴연구원'];

  /* ---------- 추적 링크(UTM → 단축링크) ---------- */
  const shortCache = new Map(); // UTM 링크 → 단축링크(진행 중이면 Promise)
  const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim());
  function ensureLink(p) {
    const utm = LK.utmUrl(p);
    if (!utm || !validEmail(p.email)) return Promise.resolve(null);
    if (p.shortFor === utm && p.shortUrl) return Promise.resolve(p.shortUrl);
    if (!shortCache.has(utm)) {
      shortCache.set(utm, LK.ensureShort(utm).catch((err) => { shortCache.delete(utm); throw err; }));
    }
    return shortCache.get(utm).then((s) => { p.shortUrl = s; p.shortFor = utm; return s; });
  }
  // QR에 넣을 값: 확정된 단축링크, 없으면 UTM 링크(임시)
  const qrTextOf = (p) => (p.shortUrl && p.shortFor === LK.utmUrl(p) ? p.shortUrl : LK.utmUrl(p));
  async function refreshLink(p) {
    if (!p) return;
    renderLink(p, '단축링크를 확인하는 중…');
    try { await ensureLink(p); renderLink(p); schedulePreview(); }
    catch (err) { renderLink(p, '단축링크를 만들지 못했습니다. 잠시 뒤 다시 시도해 주세요. (' + err.message + ')', true); }
  }
  function renderLink(p, msg, err) {
    if (!p || p.id !== state.activeId) return;
    const utm = LK.utmUrl(p), ok = p.shortUrl && p.shortFor === utm;
    $('#utmUrl').value = utm || '';
    $('#shortUrl').value = ok ? p.shortUrl : '';
    const el = $('#linkMsg');
    el.textContent = msg || (ok ? `utm_content=${LK.contentId(p)} · QR에는 단축링크가 들어갑니다.` : (validEmail(p.email) ? '' : '이메일을 입력하면 추적 링크가 만들어집니다.'));
    el.style.color = err ? '#b42318' : '';
  }

  /* ---------- 1. 엑셀 ---------- */
  const fileInput = $('#file'), drop = $('#drop');
  fileInput.addEventListener('change', (e) => e.target.files[0] && readFile(e.target.files[0]));
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => e.dataTransfer.files[0] && readFile(e.dataTransfer.files[0]));

  async function readFile(f) {
    try {
      const buf = await f.arrayBuffer();
      state.wb = XLSX.read(buf, { type: 'array' });
      const sel = $('#sheet');
      sel.innerHTML = state.wb.SheetNames.map((n, i) => `<option value="${i}">${esc(n)}</option>`).join('');
      $('#sheetRow').hidden = state.wb.SheetNames.length < 2;
      loadSheet(0);
      drop.querySelector('strong').textContent = f.name;
    } catch (err) { status('엑셀을 읽지 못했습니다: ' + err.message, true); }
  }
  $('#sheet').addEventListener('change', (e) => loadSheet(+e.target.value));

  function loadSheet(i) {
    const ws = state.wb.Sheets[state.wb.SheetNames[i]];
    loadRows(XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false }));
  }
  // DB 불러오기 결과는 버튼 바로 아래에 보여 준다(④의 상태줄은 화면 밖에 있을 수 있음).
  const dbNote = (msg, err) => { const el = $('#dbLoadNote'); el.textContent = msg; el.style.color = err ? '#b42318' : ''; };
  $('#dbLoad').addEventListener('click', async () => {
    const b = $('#dbLoad');
    if (!DBLoad.ready()) { dbNote('아직 Google 로그인 연결(클라이언트 ID)이 설정되지 않았습니다. 관리자가 메일 서명 페이지의 ‘DB 바로 불러오기 설정’을 마치면 쓸 수 있습니다. 지금은 아래 파일 불러오기를 써 주세요.', true); return; }
    b.disabled = true; dbNote('구성원 DB를 불러오는 중…');
    try { loadRows(await DBLoad.fetchRows()); dbNote('구성원 DB 시트에서 불러왔습니다. 시트를 고친 뒤 다시 누르면 새 내용이 반영됩니다.'); }
    catch (err) { dbNote(err.message, true); }
    finally { b.disabled = false; }
  });
  // 구성원: 본인 정보만 불러오기. 연구소 계정으로 로그인되어 있으면 페이지를 열 때 자동으로 불러온다.
  let meLoaded = false;
  async function loadMe(force) {
    if (meLoaded && !force) return;
    dbNote('내 정보를 불러오는 중…');
    try {
      const j = await DBLoad.callSelf('me');
      loadRows(j.rows); meLoaded = true;
      const p = state.people.find((x) => !x.isNew);
      if (p) { state.activeId = p.id; p.selected = true; renderList(); renderForm(); preview(); refreshLink(p); }
      dbNote(`${j.email} 계정으로 내 정보를 불러왔습니다. ③에서 확인하고 ④에서 내려받으세요.`);
    } catch (err) { dbNote(err.message, true); }
  }
  $('#meLoad').addEventListener('click', () => loadMe(true));
  if (DBLoad.selfReady()) {
    $('#meLoad').hidden = true;
    DBLoad.initSignIn($('#gsiBtn'), () => loadMe(false)).catch((e) => { $('#meLoad').hidden = false; dbNote(e.message, true); });
  }
  function loadRows(rows) {
    try {
      const fresh = C.rowsToPeople(rows).map((p) => ({ ...p, id: ++state.seq, selected: false }));
      state.people = state.people.filter((p) => p.isNew).concat(fresh);
      state.activeId = null;
      renderList(); renderForm(); preview();
      status(`${fresh.length}명을 불러왔습니다. 이름을 눌러 확인하고, 내려받을 사람을 체크하세요.`);
    } catch (err) { status(err.message, true); }
  }

  /* ---------- 2. 목록 ---------- */
  $('#q').addEventListener('input', renderList);
  $('#addNew').addEventListener('click', () => {
    const p = { ...C.makePerson({ name: '', dept: '기후시민팀', title: '연구원', mobile: '', email: '' }), id: ++state.seq, selected: true, isNew: true };
    p.email = '';
    state.people.unshift(p); state.activeId = p.id;
    renderList(); renderForm(); preview();
    $('#fields [name=name]').focus();
  });
  $('#selAll').addEventListener('click', () => { visible().forEach((p) => (p.selected = true)); renderList(); });
  $('#selNone').addEventListener('click', () => { state.people.forEach((p) => (p.selected = false)); renderList(); });

  const visible = () => {
    const q = $('#q').value.trim();
    return state.people.filter((p) => !q || (p.name + p.nameEn).toLowerCase().includes(q.toLowerCase()));
  };

  function renderList() {
    const list = $('#list');
    const ps = visible();
    if (!state.people.length) { list.innerHTML = '<p class="empty">엑셀을 불러오거나 ‘신규 입사자 직접 입력’을 눌러 주세요.</p>'; updateCount(); return; }
    let html = '', last = null;
    ps.forEach((p) => {
      const grp = p.isNew ? '신규 입력' : (['이사장', '소장', '부소장'].includes(p.dept) ? '임원' : p.dept || '기타');
      if (grp !== last) { html += `<div class="grp">${esc(grp)}</div>`; last = grp; }
      html += `<div class="item${p.id === state.activeId ? ' active' : ''}" data-id="${p.id}">
        <input type="checkbox" aria-label="${esc(p.name || '이름 없음')} 선택" ${p.selected ? 'checked' : ''}>
        <span class="nm">${esc(p.name || '(이름 입력)')}</span>${p.isNew ? '<span class="new">신규</span>' : ''}
        <span class="tt">${esc(p.titleKr)}</span></div>`;
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
    renderList(); renderForm(); preview(); refreshLink(p);
  });
  function updateCount() {
    const n = state.people.filter((p) => p.selected).length;
    $('#count').textContent = n ? `${n}명 선택됨` : '';
    ['#dlAi', '#dlPng'].forEach((k) => ($(k).disabled = !n));
    $('#dlAi').textContent = n > 1 ? `인쇄발주용 AI (${n}명 ZIP)` : '인쇄발주용 AI';
    renderOrder();
  }

  /* ---------- 3. 편집 ---------- */
  const form = $('#form');
  const opt = (arr, v) => [...new Set([...arr, v].filter(Boolean))].map((x) => `<option${x === v ? ' selected' : ''}>${esc(x)}</option>`).join('');
  function renderForm() {
    const p = byId(state.activeId);
    $('#fields').hidden = !p; $('#formEmpty').hidden = !!p;
    if (!p) return;
    form.elements.dept.innerHTML = opt(DEPTS, p.dept);
    form.elements.title.innerHTML = opt(TITLES, p.title);
    ['name', 'nameEn', 'titleKr', 'titleEn', 'mobile', 'tel', 'email', 'address'].forEach((k) => (form.elements[k].value = p[k] || ''));
    renderLink(p);
  }
  form.addEventListener('input', (e) => {
    const p = byId(state.activeId); if (!p) return;
    const k = e.target.name; p[k] = e.target.value;
    if (k === 'name') { p.nameEn = C.romanizeName(p.name); form.elements.nameEn.value = p.nameEn; }
    if (k === 'dept' || k === 'title') {
      const t = C.titleLines(p.dept, p.title); p.titleKr = t.kr; p.titleEn = t.en;
      form.elements.titleKr.value = t.kr; form.elements.titleEn.value = t.en;
    }
    if (k === 'name' || k === 'dept' || k === 'title') renderList();
    if (k === 'email' || k === 'nameEn') renderLink(p);
    schedulePreview();
  });
  form.addEventListener('change', (e) => {
    const p = byId(state.activeId); if (!p) return;
    if (e.target.name === 'mobile' || e.target.name === 'tel') { p[e.target.name] = C.fmtPhone(e.target.value); e.target.value = p[e.target.name]; schedulePreview(); }
    if (e.target.name === 'email') { p.email = e.target.value.trim(); e.target.value = p.email; refreshLink(p); }
  });
  form.addEventListener('submit', (e) => e.preventDefault());
  $('#reRoman').addEventListener('click', () => {
    const p = byId(state.activeId); if (!p) return;
    p.nameEn = C.romanizeName(p.name); form.elements.nameEn.value = p.nameEn; schedulePreview();
  });

  /* ---------- 4. 미리보기 ---------- */
  let timer = null, ticket = 0;
  const schedulePreview = () => { clearTimeout(timer); timer = setTimeout(preview, 250); };
  async function preview() {
    const p = byId(state.activeId);
    const my = ++ticket;
    const a = await loadAssets();
    const person = p || C.makePerson({ name: '홍길동', dept: '기후시민팀', title: '연구원', mobile: '01012345678', email: 'gildong.hong@igt.or.kr' });
    const bytes = await CardPDF.buildCards(a.base, a.font, [{ ...person, qrText: qrTextOf(person) }], fontkit);
    if (my !== ticket) return;
    // 미리보기마다 서체 서브셋이 달라지므로 FontFace 캐시를 쓰지 않고 글리프를 직접 그림
    const pdf = await pdfjsLib.getDocument({ data: bytes, worker: pdfWorker, disableFontFace: true }).promise;
    if (my !== ticket) { pdf.destroy(); return; }
    await Promise.all([drawPage(pdf, 1, $('#cvFront')), drawPage(pdf, 2, $('#cvBack'))]);
    pdf.destroy();
    if (!p && !state.people.length) status('예시(홍길동) 미리보기입니다.');
  }
  // 미리보기는 재단선(90×50) 안쪽만 보여 줌
  async function drawPage(pdf, n, cv) {
    const page = await pdf.getPage(n);
    const w = cv.parentElement.clientWidth || 500;
    const vp0 = page.getViewport({ scale: 1 });
    const trimW = vp0.width - 4 * 72 / 25.4;
    const scale = (w / trimW) * Math.min(window.devicePixelRatio || 1, 3);
    const vp = page.getViewport({ scale });
    const full = document.createElement('canvas'); full.width = Math.round(vp.width); full.height = Math.round(vp.height);
    await page.render({ canvasContext: full.getContext('2d'), viewport: vp }).promise;
    const m = 2 * 72 / 25.4 * scale;
    cv.width = Math.round(vp.width - 2 * m); cv.height = Math.round(vp.height - 2 * m);
    cv.getContext('2d').drawImage(full, m, m, cv.width, cv.height, 0, 0, cv.width, cv.height);
  }
  window.addEventListener('resize', schedulePreview);

  /* ---------- 내려받기 ---------- */
  $('#dlAi').addEventListener('click', () => download('ai'));
  $('#dlPng').addEventListener('click', () => download('png'));

  const ymd = () => { const d = new Date(); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`; };
  const safe = (s) => String(s || '이름없음').replace(/[\\/:*?"<>|\s]+/g, '_');
  function saveBlob(blob, fname) {
    const url = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement('a'), { href: url, download: fname });
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  // 재단 크기(90×50mm) PNG: 94×54 페이지를 그린 뒤 사방 도련 2mm를 잘라냄
  async function pngPages(pdfBytes, dpi) {
    const pdf = await pdfjsLib.getDocument({ data: pdfBytes, worker: pdfWorker, disableFontFace: true }).promise;
    const out = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const vp = page.getViewport({ scale: dpi / 72 });
      const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
      await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
      const m = Math.round(2 * dpi / 25.4), w = Math.round(90 * dpi / 25.4), h = Math.round(50 * dpi / 25.4);
      const crop = document.createElement('canvas'); crop.width = w; crop.height = h;
      crop.getContext('2d').drawImage(cv, m, m, w, h, 0, 0, w, h);
      out.push(await new Promise((r) => crop.toBlob(r, 'image/png')));
    }
    pdf.destroy();
    return out;
  }
  // 한 사람 분 파일들 → [{name, data}]
  async function filesFor(p, kind, a) {
    const one = [{ ...p, qrText: p.shortUrl }];
    const base = `녹색전환연구소_명함_${safe(p.name)}`;
    if (kind === 'ai') return [{ name: `${base}_인쇄용.ai`, data: await CardPDF.buildCards(a.base, a.font, one, fontkit, { outline: true }) }];
    const bytes = await CardPDF.buildCards(a.base, a.font, one, fontkit, { outline: true, editingData: false });
    const [front, back] = await pngPages(bytes, 600);
    return [{ name: `${base}_앞면.png`, data: front }, { name: `${base}_뒷면.png`, data: back }];
  }
  const LABEL = { ai: '인쇄용_AI', png: 'PNG' };
  async function download(kind) {
    const sel = state.people.filter((p) => p.selected);
    const missing = sel.filter((p) => !p.name.trim() || !p.mobile.trim() || !p.email.trim());
    if (missing.length && !confirm(`이름·휴대전화·이메일이 비어 있는 명함이 ${missing.length}장 있습니다. 그대로 만들까요?`)) return;
    const btns = ['#dlAi', '#dlPng'].map((k) => $(k));
    btns.forEach((b) => (b.disabled = true));
    status('QR 단축링크를 확인하는 중입니다…');
    try {
      for (const p of sel) {
        if (!validEmail(p.email)) throw new Error(`${p.name || '이름 없음'}: 이메일이 없어 QR 추적 링크를 만들 수 없습니다.`);
        await ensureLink(p);
      }
      const a = await loadAssets();
      const files = [];
      for (const [i, p] of sel.entries()) {
        status(`파일을 만드는 중입니다… (${i + 1}/${sel.length})`);
        files.push(...await filesFor(p, kind, a));
      }
      let fname;
      if (files.length === 1) {
        fname = files[0].name.replace(/(\.\w+)$/, `_${ymd()}$1`);
        saveBlob(new Blob([files[0].data], { type: 'application/postscript' }), fname);
      } else {
        const zip = new JSZip();
        files.forEach((f) => zip.file(f.name, f.data));
        const who = sel.length === 1 ? safe(sel[0].name) : `${sel.length}명`;
        fname = `녹색전환연구소_명함_${who}_${LABEL[kind]}_${ymd()}.zip`;
        saveBlob(await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }), fname);
      }
      status(`${fname} 파일을 내려받았습니다.${kind === 'ai' ? ' 강프린팅 주문은 아래 인쇄 주문 가이드의 ‘주문 메일 만들기’를 쓰면 됩니다.' : ''}`);
    } catch (err) { status('파일 생성에 실패했습니다: ' + err.message, true); console.error(err); }
    finally { updateCount(); }
  }


  /* ---------- 강프린팅 주문 메일 ---------- */
  const OM = window.OrderMail;
  function orderSel() { return state.people.filter((p) => p.selected); }
  function orderShip() { const el = document.querySelector('input[name=orderShip]:checked'); return el ? el.value : '택배'; }
  function orderQty() { const v = parseInt(($('#orderQty') || {}).value, 10); return v > 0 ? v : 0; }
  function orderStatus(msg, err) { const el = $('#orderStatus'); el.textContent = msg; el.style.color = err ? '#b42318' : ''; }
  function renderOrder() {
    const OM = window.OrderMail;
    if (!OM || !$('#orderMail')) return;
    const sel = orderSel();
    $('#orderWho').textContent = sel.length ? `선택한 사람: ${sel.map((p) => p.name || '이름 없음').join(', ')} (${sel.length}명)` : '선택한 사람: 없음 (명함 만들기 ②에서 체크)';
    $('#orderMail').disabled = $('#orderCopy').disabled = !sel.length;
    $('#orderText').textContent = OM.compose({ people: sel.length ? sel : [{ name: '○○○' }], qty: orderQty(), delivery: orderShip(), sender: null, attachBiz: true }).text;
  }
  if (OM && $('#orderMail')) {
    $('#orderQty').addEventListener('input', renderOrder);
    document.querySelectorAll('input[name=orderShip]').forEach((r) => r.addEventListener('change', renderOrder));
    $('#orderCopy').addEventListener('click', async () => {
      const m = OM.compose({ people: orderSel(), qty: orderQty(), delivery: orderShip(), sender: null, attachBiz: true });
      try { await navigator.clipboard.writeText(`받는 사람: ${m.to}\n제목: ${m.subject}\n\n${m.text}`); orderStatus('메일 문안을 복사했습니다. 인쇄용 AI와 사업자등록증은 직접 붙여 주세요.'); }
      catch (e) { window.prompt('아래 내용을 복사하세요.', m.text); }
    });
    $('#orderMail').addEventListener('click', async () => {
      const sel = orderSel();
      if (!sel.length) return;
      if (!orderQty() && !confirm('1인당 수량이 비어 있습니다. 수량 없이 메일을 만들까요? (Gmail에서 고쳐 쓸 수 있습니다)')) return;
      const btn = $('#orderMail'); btn.disabled = true;
      // 브라우저는 클릭 한 번에 창 하나만 허용한다. 로그인이 필요하면 로그인 창을 먼저 띄우고,
      // 이미 로그인되어 있으면 Gmail용 탭을 미리 열어 두었다가 메일이 만들어지면 임시보관함으로 보낸다.
      let tab = null;
      const needLogin = !OM.hasToken();
      const login = needLogin ? OM.login() : Promise.resolve();
      if (!needLogin) {
        tab = window.open('about:blank', '_blank');
        if (tab) { try { tab.opener = null; tab.document.title = 'Gmail 임시보관함 여는 중'; tab.document.body.innerHTML = '<p style="font:16px sans-serif;padding:24px">주문 메일을 만드는 중입니다. 다 만들어지면 Gmail 임시보관함이 열립니다…</p>'; } catch (e) {} }
      }
      try {
        orderStatus('Google 계정으로 로그인하는 중입니다…');
        await login;
        for (const p of sel) {
          if (!validEmail(p.email)) throw new Error(`${p.name || '이름 없음'}: 이메일이 없어 QR 추적 링크를 만들 수 없습니다.`);
          orderStatus(`QR 단축링크를 확인하는 중입니다… (${p.name})`);
          await ensureLink(p);
        }
        const a = await loadAssets();
        const files = [];
        for (const [i, p] of sel.entries()) {
          orderStatus(`인쇄용 AI를 만드는 중입니다… (${i + 1}/${sel.length})`);
          const [f] = await filesFor(p, 'ai', a);
          files.push({ name: f.name.replace(/(\.ai)$/, `_${ymd()}$1`), data: f.data, type: 'application/postscript' });
        }
        const r = await OM.draft({ people: sel, qty: orderQty(), delivery: orderShip(), files, onStep: orderStatus });
        let opened = false;
        if (tab && !tab.closed) { tab.location.href = r.url; opened = true; }
        else { const w = window.open(r.url, '_blank'); opened = !!w; }
        const bizNote = r.attachedBiz ? '' : ' 사업자등록증은 권한이 없어 붙이지 못했으니 직접 첨부해 주세요.';
        orderStatus(`Gmail 임시보관함에 주문 메일을 만들었습니다.${bizNote} ${opened ? '열린 Gmail 탭에서 확인한 뒤 보내 주세요.' : '아래 버튼을 눌러 임시보관함을 열어 주세요.'}`, !r.attachedBiz);
        const go = document.createElement('a');
        go.href = r.url; go.target = '_blank'; go.rel = 'noopener'; go.className = 'btn primary'; go.textContent = 'Gmail 임시보관함 열기';
        go.style.marginTop = '10px';
        $('#orderStatus').appendChild(document.createElement('br')); $('#orderStatus').appendChild(go);
      } catch (err) { if (tab && !tab.closed) tab.close(); orderStatus('주문 메일을 만들지 못했습니다: ' + err.message, true); console.error(err); }
      finally { btn.disabled = !orderSel().length; }
    });
  }

  /* ---------- 링크 복사 · 시트 행 복사 ---------- */
  async function copyText(t, okMsg) {
    try { await navigator.clipboard.writeText(t); status(okMsg); }
    catch (e) { window.prompt('아래 내용을 복사하세요.', t); }
  }
  $('#copyShort').addEventListener('click', () => { const v = $('#shortUrl').value; if (v) copyText(v, '단축링크를 복사했습니다.'); });
  $('#copyRows').addEventListener('click', async () => {
    const sel = state.people.filter((p) => p.selected);
    if (!sel.length) return;
    status('단축링크를 확인하는 중입니다…');
    try {
      for (const p of sel) { if (validEmail(p.email)) await ensureLink(p); }
      const rows = sel.filter((p) => p.shortUrl).map((p) => LK.sheetRow(p, p.shortUrl).join('\t'));
      await copyText(rows.join('\n'), `${rows.length}명분 행을 복사했습니다. ‘UTM코드 생성기’ 시트 맨 아래 빈 행의 A열에 붙여넣으세요.`);
    } catch (err) { status('행 복사 실패: ' + err.message, true); }
  });

  /* ---------- util ---------- */
  function byId(id) { return state.people.find((p) => p.id === id); }
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function status(msg, err) { const el = $('#status'); el.textContent = msg; el.style.color = err ? '#b42318' : ''; }

  renderOrder();
  preview();
})();
