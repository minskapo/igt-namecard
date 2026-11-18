// 강프린팅 명함 주문 메일: 제작 사양·결제 정보 문안을 만들고, 인쇄용 AI와 사업자등록증을 붙인 Gmail 임시보관함 메일을 만든다.
// 메일은 보내지 않는다. 임시보관함에 만든 뒤 Gmail에서 열어 사람이 확인하고 보낸다.
(function (root) {
  const ORDER = {
    to: 'kang-printing@naver.com',
    printer: '강프린팅',
    paper: '반누보 스노우화이트 320g',
    print: '양면 인쇄 (앞면 별색 PANTONE 909 C, 뒷면 먹 1도)',
    size: '90×50mm 재단 (작업파일은 94×54mm, 도련 2mm 적용)',
    address: '서울특별시 중구 중림로7길 4, 2층 녹색전환연구소',
    org: '사단법인 녹색전환연구소',
    bizNo: '101-82-74548',
    ceo: '윤정숙',
    // 공유 드라이브의 사업자등록증 (운영기획팀 관리). 열람 권한이 있는 사람만 자동으로 붙는다.
    bizFileId: '1wf_Gj4t6-kk6dnCeiw4tOlb484hk5_Q8',
    bizFileName: '사업자등록증_사단법인 녹색전환연구소.pdf'
  };
  const CLIENT_ID = '532335212691-7cspiov3o1e3eocf2gmvcp402p7jelbc.apps.googleusercontent.com';
  const SCOPES = ['openid', 'email', 'profile',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/drive.readonly'].join(' ');

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // 메일 문안. people: [{name}], qty: 1인당 수량, sender: {name, email}, attachBiz: 사업자등록증 첨부 여부, delivery: '택배' | '퀵'
  function compose({ people, qty, sender, attachBiz, delivery }) {
    const ship = delivery === '퀵' ? '선불 퀵으로' : '택배로';
    const n = people.length, names = people.map((p) => p.name).filter(Boolean);
    const who = n === 1 ? `${names[0]} 1명` : `${n}명`;
    const subject = `녹색전환연구소 / 명함 인쇄 주문드립니다 (${who})`;
    const me = sender && sender.name ? sender.name : '';
    const mail = sender && sender.email ? sender.email : '';
    const total = qty && n ? ` (총 ${(qty * n).toLocaleString('ko-KR')}매)` : '';
    const items = [
      ['인쇄파일', `첨부파일 참조 (${n}명, 1인 1파일 · AI)`, names.length ? [names.join(', ')] : []],
      ['용지', ORDER.paper],
      ['인쇄', ORDER.print],
      ['사이즈', ORDER.size],
      ['수량', qty ? `1인당 ${qty.toLocaleString('ko-KR')}매${n > 1 ? total : ''}` : '1인당 ○매']
    ];
    const pay = [
      [`${ship} 보내주시면 됩니다.`, [`받는 곳: ${ORDER.address}`]],
      ['배송비 포함 세금계산서를 보내주시면 계좌이체하겠습니다.', [
        `${ORDER.org}${attachBiz ? ' (사업자등록증 첨부)' : ''}`,
        `사업자등록번호: ${ORDER.bizNo}`,
        `대표자: ${ORDER.ceo}`,
        `계산서 보내실 곳: ${mail || '(보내는 사람 메일)'}`
      ]]
    ];
    const greet = [`안녕하세요, 녹색전환연구소 ${me}입니다.`.replace(' 입니다', '입니다'), '아래와 같이 명함 인쇄 주문드립니다.'];
    const close = ['감사합니다.', me ? `${me} 드림` : ''];

    const text = [...greet, '', '[ 주문내용 ]', '',
      ...items.flatMap(([k, v, sub]) => [`• ${k}: ${v}`, ...(sub || []).map((s) => `    • ${s}`)]), '',
      '[ 결제 및 배송 ]', '',
      ...pay.flatMap(([v, sub]) => [`• ${v}`, ...(sub || []).map((s) => `    • ${s}`)]), '',
      ...close].join('\n');

    const li = (v, sub) => `<li>${esc(v)}${sub && sub.length ? `<ul>${sub.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}</li>`;
    const html = `<div>${greet.map(esc).join('</div><div>')}</div><div>&#160;</div>` +
      `<div><strong>[ 주문내용 ]</strong></div><ul>${items.map(([k, v, sub]) => li(`${k}: ${v}`, sub)).join('')}</ul>` +
      `<div><strong>[ 결제 및 배송 ]</strong></div><ul>${pay.map(([v, sub]) => li(v, sub)).join('')}</ul>` +
      `<div>${close.filter(Boolean).map(esc).join('</div><div>')}</div>`;
    return { to: ORDER.to, subject, text, html };
  }

  /* ---------- Google 로그인 (Gmail 임시보관함·드라이브 읽기) ---------- */
  let token = null, tokenExp = 0, gsi = null;
  function loadGsi() {
    if (root.google && root.google.accounts && root.google.accounts.oauth2) return Promise.resolve(root.google);
    if (gsi) return gsi;
    gsi = new Promise((ok, no) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client'; s.async = true;
      s.onload = () => ok(root.google); s.onerror = () => no(new Error('Google 로그인 모듈을 불러오지 못했습니다.'));
      document.head.appendChild(s);
    });
    return gsi;
  }
  function getToken() {
    if (token && Date.now() < tokenExp - 60000) return Promise.resolve(token);
    return loadGsi().then((google) => new Promise((ok, no) => {
      const client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID, scope: SCOPES, hd: 'igt.or.kr',
        callback: (r) => {
          if (r.error) return no(new Error(r.error_description || r.error));
          if (!google.accounts.oauth2.hasGrantedAllScopes(r, 'https://www.googleapis.com/auth/gmail.compose'))
            return no(new Error('Gmail 임시보관함 권한을 허용해야 메일을 만들 수 있습니다.'));
          token = r.access_token; tokenExp = Date.now() + (r.expires_in || 3600) * 1000; ok(token);
        },
        error_callback: (e) => no(new Error(e && e.type === 'popup_closed' ? '로그인 창이 닫혔습니다.' : '로그인하지 못했습니다. 팝업 차단을 확인해 주세요.'))
      });
      client.requestAccessToken({ prompt: token ? '' : 'select_account' });
    }));
  }
  const api = async (url, opt) => {
    const t = await getToken();
    const r = await fetch(url, { ...(opt || {}), headers: { ...((opt && opt.headers) || {}), Authorization: 'Bearer ' + t } });
    if (r.status === 401) { token = null; }
    return r;
  };
  async function me() {
    const r = await api('https://www.googleapis.com/oauth2/v3/userinfo');
    if (!r.ok) return { name: '', email: '' };
    const j = await r.json();
    return { name: j.name || '', email: j.email || '' };
  }
  // 사업자등록증 PDF (공유 드라이브). 권한이 없으면 null
  async function bizFile() {
    const r = await api(`https://www.googleapis.com/drive/v3/files/${ORDER.bizFileId}?alt=media&supportsAllDrives=true`);
    if (!r.ok) return null;
    return { name: ORDER.bizFileName, type: 'application/pdf', data: new Uint8Array(await r.arrayBuffer()) };
  }

  /* ---------- MIME 메일 ---------- */
  const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const utf8 = (s) => new TextEncoder().encode(s);
  const wrap = (s) => s.replace(/.{1,76}/g, '$&\r\n');
  const hdr = (s) => `=?UTF-8?B?${b64(utf8(s))}?=`;
  function mime({ from, to, subject, text, html, files }) {
    const B1 = 'igt_mix_' + Date.now().toString(36), B2 = 'igt_alt_' + Math.random().toString(36).slice(2);
    const L = [];
    if (from) L.push(`From: ${from}`);
    L.push(`To: ${to}`, `Subject: ${hdr(subject)}`, 'MIME-Version: 1.0', `Content-Type: multipart/mixed; boundary="${B1}"`, '',
      `--${B1}`, `Content-Type: multipart/alternative; boundary="${B2}"`, '',
      `--${B2}`, 'Content-Type: text/plain; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap(b64(utf8(text))),
      `--${B2}`, 'Content-Type: text/html; charset=UTF-8', 'Content-Transfer-Encoding: base64', '', wrap(b64(utf8(`<html><body>${html}</body></html>`))),
      `--${B2}--`);
    for (const f of files) {
      const enc = encodeURIComponent(f.name);
      L.push(`--${B1}`, `Content-Type: ${f.type || 'application/octet-stream'}; name="${hdr(f.name)}"`,
        `Content-Disposition: attachment; filename="${hdr(f.name)}"; filename*=UTF-8''${enc}`,
        'Content-Transfer-Encoding: base64', '', wrap(b64(f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data))));
    }
    L.push(`--${B1}--`, '');
    return L.join('\r\n');
  }

  // 임시보관함 메일 만들기 → {url, attachedBiz, sender}
  async function draft({ people, qty, delivery, files, onStep }) {
    const step = onStep || (() => {});
    step('Google 계정을 확인하는 중입니다…');
    const sender = await me();
    step('사업자등록증을 불러오는 중입니다…');
    const biz = await bizFile().catch(() => null);
    const m = compose({ people, qty, sender, attachBiz: !!biz, delivery });
    const all = files.map((f) => ({ ...f, type: f.type || 'application/postscript' }));
    if (biz) all.push(biz);
    // Gmail의 업로드 주소(upload/gmail)는 브라우저 호출(CORS)을 받지 않으므로, 일반 주소에 raw(base64url)로 보낸다.
    const send = async (attach) => {
      const raw = mime({ from: sender.email, to: m.to, subject: m.subject, text: m.text, html: m.html, files: attach });
      const rawB64 = b64(utf8(raw)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      try {
        return await api('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: { raw: rawB64 } })
        });
      } catch (e) { return { ok: false, status: 0 }; } // 너무 큰 요청은 CORS 헤더 없이 거절되어 fetch 오류로 보일 수 있다
    };
    step('Gmail 임시보관함에 메일을 만드는 중입니다…');
    let r = await send(all);
    // 너무 크면 인쇄용 AI를 ZIP 하나로 묶어 다시 시도
    if ([0, 400, 413].includes(r.status) && files.length > 1 && root.JSZip) {
      step('첨부파일이 커서 인쇄용 AI를 ZIP으로 묶는 중입니다…');
      const zip = new root.JSZip();
      files.forEach((f) => zip.file(f.name, f.data));
      const zdata = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
      const zname = `녹색전환연구소_명함_${people.length}명_인쇄용_AI.zip`;
      r = await send([{ name: zname, type: 'application/zip', data: zdata }, ...(biz ? [biz] : [])]);
    }
    if ([0, 400, 413].includes(r.status)) throw new Error('메일을 만들지 못했습니다. 첨부파일이 너무 크거나 연결이 끊겼습니다. 사람을 나눠서 다시 만들어 주세요.');
    if (r.status === 403) {
      const j = await r.json().catch(() => ({}));
      const msg = (j.error && j.error.message) || '';
      if (/has not been used|is disabled|accessNotConfigured/i.test(msg + JSON.stringify(j)))
        throw new Error('연구소 Google Cloud 프로젝트에서 Gmail API가 아직 켜져 있지 않습니다. 관리자(김민석)에게 알려 주세요.');
      throw new Error('Gmail 임시보관함 권한이 없습니다. 로그인 창에서 권한을 모두 허용해 주세요. (' + msg.slice(0, 120) + ')');
    }
    if (!r.ok) throw new Error('메일을 만들지 못했습니다 (' + r.status + ').');
    const d = await r.json();
    const id = d.message && d.message.id;
    const url = `https://mail.google.com/mail/?authuser=${encodeURIComponent(sender.email)}#drafts?compose=${id}`;
    return { url, attachedBiz: !!biz, sender };
  }

  // 버튼을 누른 순간 로그인 창을 띄워야 팝업이 막히지 않으므로, 페이지가 열릴 때 로그인 모듈을 미리 불러 둔다.
  if (typeof document !== 'undefined') loadGsi().catch(() => {});
  const out = { ORDER, compose, draft, mime, login: getToken };
  if (typeof module !== 'undefined' && module.exports) module.exports = out; else root.OrderMail = out;
})(typeof window !== 'undefined' ? window : globalThis);
