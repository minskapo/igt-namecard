/**
 * 녹색전환연구소 메일 서명: 구성원 셀프 반영 (Google Apps Script 웹앱)
 *
 * 하는 일
 *  - me      : 로그인한 구성원의 DB 한 줄만 돌려준다. 구성원에게 DB 시트를 공유하지 않아도 된다.
 *  - publish : 구성원이 서명 페이지에서 만든 본인 서명 이미지 10장을 GitHub 저장소에 올리고,
 *              바꾼 국문·영문 직함과 LinkedIn 주소를 DB에 적는다. 본인 서명 코드 폴더에만 쓸 수 있다.
 *
 * 설치 (관리자, 처음 한 번)
 *  1) DB 시트 소유자 계정으로 script.new 에서 새 프로젝트를 만들고 이 파일 내용을 붙여 넣는다.
 *  2) 프로젝트 설정 › 스크립트 속성에 GITHUB_TOKEN 을 넣는다.
 *     (GitHub fine-grained token: 저장소 minskapo/igt-namecard 만, Contents 읽기·쓰기)
 *  3) 배포 › 새 배포 › 웹 앱: 실행 계정 '나', 액세스 권한 '모든 사용자'.
 *     로그인 확인은 아래 verify()가 Google ID 토큰으로 직접 한다.
 *  4) 웹 앱 URL을 js/db-load.js 의 selfUrl 에 넣는다.
 */
const CFG = {
  CLIENT_ID: '532335212691-7cspiov3o1e3eocf2gmvcp402p7jelbc.apps.googleusercontent.com',
  DOMAIN: 'igt.or.kr',
  DB_ID: '1qAy53XI3rvwB5zf1y3fYk7dm7XejXDxdo68vZmTd1MI',
  DB_TAB: '구성원',
  REPO: 'minskapo/igt-namecard',
  BRANCH: 'main',
  MAX_BYTES: 400000
};
const PARTS = ['a', 'm1', 'm2', 'm3', 'b'];
const LANGS = ['kr', 'en'];

function doPost(e) {
  let out;
  try {
    const req = JSON.parse(e.postData.contents);
    const email = verify(req.idToken);
    if (req.action === 'me') out = me(email);
    else if (req.action === 'publish') out = publish(email, req);
    else throw new Error('알 수 없는 요청입니다.');
  } catch (x) {
    out = { ok: false, error: String((x && x.message) || x) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput('IGT signature self-service: OK');
}

// 서명 페이지의 Google 로그인(ID 토큰)이 우리 클라이언트에서, 연구소 계정으로 발급된 것인지 확인한다.
function verify(idToken) {
  if (!idToken) throw new Error('로그인이 필요합니다.');
  const r = UrlFetchApp.fetch('https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(idToken), { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error('로그인이 만료되었습니다. 페이지를 새로고침해 주세요.');
  const t = JSON.parse(r.getContentText());
  if (t.aud !== CFG.CLIENT_ID) throw new Error('허용되지 않은 로그인입니다.');
  if (Number(t.exp) * 1000 < Date.now()) throw new Error('로그인이 만료되었습니다. 페이지를 새로고침해 주세요.');
  const email = String(t.email || '').toLowerCase();
  if (!email.endsWith('@' + CFG.DOMAIN) || String(t.email_verified) !== 'true') throw new Error('연구소 계정(@' + CFG.DOMAIN + ')으로 로그인해 주세요.');
  return email;
}

function readDb() {
  const sh = SpreadsheetApp.openById(CFG.DB_ID).getSheetByName(CFG.DB_TAB);
  const v = sh.getDataRange().getDisplayValues();
  return { sh: sh, head: v[0], rows: v.slice(1) };
}
function findRow(d, email) {
  const iE = d.head.indexOf('이메일'), iS = d.head.indexOf('상태');
  for (let i = 0; i < d.rows.length; i++) {
    if (String(d.rows[i][iE]).trim().toLowerCase() === email && String(d.rows[i][iS]).trim() !== '퇴사') return i;
  }
  throw new Error('구성원 DB에서 ' + email + ' 을(를) 찾지 못했습니다. 운영기획팀에 알려 주세요.');
}

function me(email) {
  const d = readDb(), i = findRow(d, email);
  return { ok: true, email: email, rows: [d.head, d.rows[i]] };
}

function publish(email, req) {
  if (String(req.email || '').trim().toLowerCase() !== email) throw new Error('본인 서명만 반영할 수 있습니다. 목록에서 본인 이름을 골라 주세요.');
  const cache = CacheService.getScriptCache(), key = 'pub:' + email;
  if (cache.get(key)) throw new Error('방금 반영했습니다. 1분 뒤에 다시 시도해 주세요.');
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const d = readDb(), i = findRow(d, email);
    const code = String(d.rows[i][d.head.indexOf('서명 코드')] || '').trim();
    if (!/^[a-z0-9]{8,32}$/.test(code)) throw new Error('서명 코드가 아직 없습니다. 관리자에게 요청해 주세요.');

    const linkedin = typeof req.linkedin === 'string' ? req.linkedin.trim() : null;
    if (linkedin && !/^https:\/\/([a-z]{2,3}\.)?linkedin\.com\/[^\s"'<>]+$/i.test(linkedin)) throw new Error('LinkedIn 주소 형식이 맞지 않습니다.');
    const files = req.files || {}, items = [];
    LANGS.forEach(function (l) {
      PARTS.forEach(function (p) {
        const k = l + '_' + p, b64 = files[k];
        if (!b64) throw new Error('이미지가 빠졌습니다: ' + k);
        const bytes = Utilities.base64Decode(b64);
        if (bytes.length > CFG.MAX_BYTES) throw new Error('이미지가 너무 큽니다: ' + k);
        // PNG 시그니처 (Java byte는 부호가 있어 0x89 = -119)
        if (!(bytes[0] === -119 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71)) throw new Error('PNG 이미지가 아닙니다: ' + k);
        items.push({ path: 'assets/email/sig/' + code + '/' + k + '.png', b64: b64 });
      });
    });
    const sha = commit(items, '메일 서명 셀프 반영: ' + email.split('@')[0]);

    // 바꾼 직함을 DB에 적어 두어야 관리자가 다시 일괄 적용해도 그대로 유지된다.
    const t = req.titles || {};
    const clean = function (s) { return String(s || '').replace(/[\r\n\t]/g, ' ').replace(/^[=+\-@]+/, '').trim().slice(0, 80); };
    const put = function (col, val) { const c = d.head.indexOf(col); if (c >= 0 && val) d.sh.getRange(i + 2, c + 1).setValue(val); };
    put('국문 직함', clean(t.kr));
    put('영문 직함', clean(t.en));
    // LinkedIn 주소는 비우면 지운다(영문 서명 버튼이 연구소 페이지로 돌아간다).
    const iL = d.head.indexOf('LinkedIn');
    if (iL >= 0 && linkedin !== null) d.sh.getRange(i + 2, iL + 1).setValue(linkedin.slice(0, 200));

    cache.put(key, '1', 60);
    return { ok: true, commit: sha, code: code };
  } finally {
    lock.releaseLock();
  }
}

// GitHub Git Data API로 이미지 10장을 커밋 하나로 올린다.
function gh(method, path, body) {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('관리자 설정이 끝나지 않았습니다 (GITHUB_TOKEN).');
  const opt = { method: method, muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' } };
  if (body) { opt.contentType = 'application/json'; opt.payload = JSON.stringify(body); }
  const r = UrlFetchApp.fetch('https://api.github.com/repos/' + CFG.REPO + path, opt);
  if (r.getResponseCode() >= 300) throw new Error('저장소에 올리지 못했습니다 (GitHub ' + r.getResponseCode() + ').');
  return JSON.parse(r.getContentText());
}
function commit(items, message) {
  const base = gh('get', '/git/ref/heads/' + CFG.BRANCH).object.sha;
  const baseTree = gh('get', '/git/commits/' + base).tree.sha;
  const tree = items.map(function (it) {
    return { path: it.path, mode: '100644', type: 'blob', sha: gh('post', '/git/blobs', { content: it.b64, encoding: 'base64' }).sha };
  });
  const newTree = gh('post', '/git/trees', { base_tree: baseTree, tree: tree }).sha;
  const c = gh('post', '/git/commits', { message: message, tree: newTree, parents: [base] }).sha;
  gh('patch', '/git/refs/heads/' + CFG.BRANCH, { sha: c });
  return c;
}
