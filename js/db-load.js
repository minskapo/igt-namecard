// 구성원 DB(구글 시트)를 연구소 Google 계정으로 바로 불러온다.
// 시트는 공개하지 않고, 로그인한 사람에게 시트 열람 권한이 있을 때만 읽힌다.
(function (root) {
  const CONFIG = {
    // Google Cloud › API 및 서비스 › 사용자 인증 정보 › OAuth 2.0 클라이언트 ID (웹 애플리케이션)
    // 승인된 JavaScript 원본: https://minskapo.github.io
    clientId: '532335212691-7cspiov3o1e3eocf2gmvcp402p7jelbc.apps.googleusercontent.com',
    sheetId: '1qAy53XI3rvwB5zf1y3fYk7dm7XejXDxdo68vZmTd1MI',
    tab: '구성원',
    range: 'A1:Z500',
    domain: 'igt.or.kr',
    // 구성원 셀프 반영용 Apps Script 웹앱 주소 (tools/sig-self.gs 배포 후 넣는다)
    selfUrl: 'https://script.google.com/macros/s/AKfycbxj53QktpO_V2Ax1cRVgCdI6-x8a38uyqAGsji8dAdQa6GLXfppRwAmId_1J6NIbPVZ6A/exec'
  };
  const SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
  let gsi = null, token = null, tokenExp = 0;

  const ready = () => !!CONFIG.clientId;
  function loadGsi() {
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
        client_id: CONFIG.clientId, scope: SCOPE, hd: CONFIG.domain,
        callback: (r) => {
          if (r.error) return no(new Error(r.error_description || r.error));
          token = r.access_token; tokenExp = Date.now() + (r.expires_in || 3600) * 1000; ok(token);
        },
        error_callback: (e) => no(new Error(e && e.type === 'popup_closed' ? '로그인 창이 닫혔습니다.' : '로그인하지 못했습니다. 팝업 차단을 확인해 주세요.'))
      });
      client.requestAccessToken({ prompt: token ? '' : 'select_account' });
    }));
  }
  // 시트 값 → 2차원 배열 (엑셀 sheet_to_json(header:1)과 같은 모양)
  async function fetchRows() {
    if (!ready()) throw new Error('아직 Google 로그인 설정(클라이언트 ID)이 되지 않았습니다. 지금은 DB를 .xlsx로 받아 끌어다 놓아 주세요.');
    const t = await getToken();
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.sheetId}/values/${encodeURIComponent(CONFIG.tab + '!' + CONFIG.range)}?valueRenderOption=FORMATTED_VALUE`;
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + t } });
    if (r.status === 403 || r.status === 404) throw new Error('DB 시트를 열 권한이 없습니다. 시트 담당자에게 공유를 요청해 주세요.');
    if (r.status === 401) { token = null; throw new Error('로그인이 만료되었습니다. 다시 눌러 주세요.'); }
    if (!r.ok) throw new Error('DB를 읽지 못했습니다 (' + r.status + ').');
    const j = await r.json();
    return j.values || [];
  }
  // 구성원 본인 확인: Google 로그인(ID 토큰). 이미 동의한 연구소 계정이면 자동으로 로그인된다.
  const selfReady = () => ready() && !!CONFIG.selfUrl;
  let idTok = null, idExp = 0, idWaiters = [], idInit = false, onSignIn = null;
  const jwtExp = (t) => { try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).exp * 1000; } catch (e) { return 0; } };
  function gotCredential(r) {
    idTok = r.credential; idExp = jwtExp(idTok);
    idWaiters.splice(0).forEach((f) => f(idTok));
    if (onSignIn) onSignIn(idTok);
  }
  // 페이지가 열릴 때 부른다. auto_select로 자동 로그인을 시도하고, 버튼 자리에 Google 로그인 버튼을 그린다.
  async function initSignIn(buttonEl, cb) {
    if (!selfReady()) return false;
    onSignIn = cb;
    const google = await loadGsi();
    if (!idInit) {
      google.accounts.id.initialize({ client_id: CONFIG.clientId, callback: gotCredential, auto_select: true, hd: CONFIG.domain, use_fedcm_for_prompt: true, itp_support: true });
      idInit = true;
    }
    if (buttonEl) google.accounts.id.renderButton(buttonEl, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'continue_with', locale: 'ko' });
    google.accounts.id.prompt();
    return true;
  }
  function getIdToken() {
    if (idTok && Date.now() < idExp - 60000) return Promise.resolve(idTok);
    return new Promise((ok, no) => {
      idWaiters.push(ok);
      loadGsi().then((g) => g.accounts.id.prompt());
      setTimeout(() => no(new Error('로그인이 필요합니다. 위 ①의 Google 버튼을 눌러 연구소 계정으로 로그인해 주세요.')), 20000);
    });
  }
  // 셀프 반영 웹앱 호출 (본인 정보 불러오기, 본인 서명 반영)
  async function callSelf(action, data) {
    if (!selfReady()) throw new Error('아직 구성원용 기능이 설정되지 않았습니다. 김민석(minski@igt.or.kr)에게 알려 주세요.');
    const t = await getIdToken();
    let r;
    try { r = await fetch(CONFIG.selfUrl, { method: 'POST', body: JSON.stringify({ ...(data || {}), action, idToken: t }) }); }
    catch (e) { throw new Error('서버에 연결하지 못했습니다. 잠시 뒤 다시 시도해 주세요.'); }
    const j = await r.json().catch(() => ({ ok: false, error: '서버 응답을 읽지 못했습니다.' }));
    if (!j.ok) throw new Error(j.error || '요청을 처리하지 못했습니다.');
    return j;
  }
  root.DBLoad = { CONFIG, ready, fetchRows, selfReady, callSelf, initSignIn };
})(window);
