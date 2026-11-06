// 명함 데이터 변환 공통 로직 (브라우저·Node 겸용)
(function (root) {
  const SURNAME = {
    '김':'Kim','이':'Lee','박':'Park','최':'Choi','정':'Jeong','윤':'Yoon','조':'Cho','장':'Jang','강':'Kang',
    '오':'Oh','황':'Hwang','배':'Bae','고':'Ko','여':'Yeo','한':'Han','임':'Lim','신':'Shin','서':'Seo',
    '권':'Kwon','송':'Song','류':'Ryu','유':'Yoo','홍':'Hong','전':'Jeon','문':'Moon','양':'Yang','손':'Son',
    '백':'Baek','허':'Heo','남':'Nam','심':'Shim','노':'Noh','하':'Ha','곽':'Kwak','성':'Sung','차':'Cha',
    '주':'Joo','우':'Woo','구':'Koo','민':'Min','진':'Jin','나':'Na','지':'Ji','엄':'Eom','변':'Byun',
    '채':'Chae','원':'Won','천':'Cheon','방':'Bang','공':'Kong','현':'Hyun','함':'Ham','염':'Yeom',
    '석':'Seok','선':'Sun','설':'Seol','마':'Ma','길':'Gil','연':'Yeon','위':'Wi','표':'Pyo','명':'Myung',
    '기':'Ki','반':'Ban','왕':'Wang','금':'Keum','옥':'Ok','육':'Yook','인':'In','맹':'Maeng','제':'Je',
    '모':'Mo','탁':'Tak','국':'Kook','어':'Eo','은':'Eun','편':'Pyeon','용':'Yong','예':'Ye','경':'Kyung',
    '봉':'Bong','사':'Sa','부':'Boo','도':'Do','소':'So','라':'Ra','추':'Choo','편':'Pyeon','전':'Jeon'
  };
  const COMPOUND = {'황보':'Hwangbo','남궁':'Namgoong','제갈':'Jegal','선우':'Sunwoo','독고':'Dokgo','서문':'Seomun','사공':'Sagong'};
  const INI = ['g','kk','n','d','tt','r','m','b','pp','s','ss','','j','jj','ch','k','t','p','h'];
  const VOW = ['a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo','u','wo','we','wi','yu','eu','ui','i'];
  const FIN = ['','k','k','k','n','n','n','t','l','k','m','l','l','l','p','l','m','p','p','t','t','ng','t','t','k','t','p','t'];

  function romanizeSyllables(s) {
    let out = '';
    for (const ch of s) {
      const c = ch.charCodeAt(0) - 0xAC00;
      if (c < 0 || c > 11171) { out += ch; continue; }
      out += INI[Math.floor(c / 588)] + VOW[Math.floor((c % 588) / 28)] + FIN[c % 28];
    }
    return out;
  }
  const cap = (s) => s ? s[0].toUpperCase() + s.slice(1) : s;

  function romanizeSurname(sur) {
    if (COMPOUND[sur]) return COMPOUND[sur];
    if (sur.length === 1) return SURNAME[sur] || cap(romanizeSyllables(sur));
    // 부모 성을 함께 쓰는 경우(예: 고이) → 각 성을 하이픈으로 연결
    return [...sur].map((c) => SURNAME[c] || cap(romanizeSyllables(c))).join('-');
  }

  // 한글 이름 → "Given Family" (국어의 로마자 표기법, 성은 관용 표기)
  function romanizeName(kr) {
    kr = (kr || '').trim();
    if (!kr) return '';
    let sur, given;
    if (kr.length >= 4) { sur = kr.slice(0, 2); given = kr.slice(2); }
    else if (COMPOUND[kr.slice(0, 2)] && kr.length > 2) { sur = kr.slice(0, 2); given = kr.slice(2); }
    else { sur = kr.slice(0, 1); given = kr.slice(1); }
    return cap(romanizeSyllables(given)) + ' ' + romanizeSurname(sur);
  }

  const TEAM_EN = {
    '경제전환팀': 'Economic Transition Team',
    '지역전환팀': 'Local Transition Team',
    '기후시민팀': 'Climate Advocacy Team',
    '운영기획팀': 'Operations Planning Team'
  };
  const TITLE_EN = {
    '이사장': 'Chairperson', '소장': 'Director', '부소장': 'Deputy Director',
    '팀장': 'Team Leader', '선임연구원': 'Senior Researcher', '연구원': 'Researcher',
    '인턴연구원': 'Research Intern', '인턴': 'Research Intern'
  };
  const EXEC = ['이사장', '소장', '부소장'];

  function titleLines(dept, title) {
    dept = (dept || '').trim(); title = (title || '').trim();
    if (!dept || EXEC.includes(dept) || dept === title) {
      return { kr: title, en: TITLE_EN[title] || '' };
    }
    const teamEn = TEAM_EN[dept] || '';
    const titleEn = TITLE_EN[title] || '';
    return { kr: dept + ' ' + title, en: [titleEn, teamEn].filter(Boolean).join(', ') };
  }

  function fmtPhone(p) {
    const d = String(p || '').replace(/\D/g, '');
    let parts;
    if (d.startsWith('02')) parts = d.length === 9 ? [d.slice(0,2), d.slice(2,5), d.slice(5)] : [d.slice(0,2), d.slice(2,6), d.slice(6)];
    else parts = d.length === 10 ? [d.slice(0,3), d.slice(3,6), d.slice(6)] : [d.slice(0,3), d.slice(3,7), d.slice(7)];
    return parts.filter(Boolean).join('  ');
  }

  function pickEmail(e) {
    const list = String(e || '').split(/[\s,;]+/).filter((x) => x.includes('@'));
    return list.find((x) => /@igt\.or\.kr$/i.test(x)) || list[0] || '';
  }

  const OFFICE = { tel: '02  2135  1148', address: '서울 중구 중림로7길 4, 2층 녹색전환연구소' };

  // 엑셀 행 배열(헤더: 부서/이름/직급/핸드폰/이메일) → 명함 데이터
  function rowsToPeople(rows) {
    const h = rows.findIndex((r) => r && r.some((c) => String(c).trim() === '이름'));
    if (h < 0) throw new Error('헤더(이름 열)를 찾지 못했습니다.');
    const head = rows[h].map((c) => String(c || '').trim());
    const ix = (k) => head.indexOf(k);
    const [iD, iN, iT, iP, iE] = ['부서', '이름', '직급', '핸드폰', '이메일'].map(ix);
    const people = []; let lastDept = '';
    for (const r of rows.slice(h + 1)) {
      const name = String((r && r[iN]) || '').trim();
      if (r && r[iD] && String(r[iD]).trim() && !String(r[iD]).startsWith('*')) lastDept = String(r[iD]).trim();
      if (!name || !/^[가-힣]{2,5}$/.test(name)) continue;
      people.push(makePerson({ name, dept: lastDept, title: String(r[iT] || '').trim(), mobile: r[iP], email: r[iE] }));
    }
    return people;
  }

  function makePerson({ name, dept, title, mobile, email }) {
    const t = titleLines(dept, title);
    return {
      name, dept, title,
      nameEn: romanizeName(name),
      titleKr: t.kr, titleEn: t.en,
      mobile: fmtPhone(mobile), email: pickEmail(email),
      tel: OFFICE.tel, address: OFFICE.address
    };
  }

  const api = { romanizeName, titleLines, fmtPhone, pickEmail, rowsToPeople, makePerson, OFFICE, TEAM_EN, TITLE_EN };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CardData = api;
})(typeof window !== 'undefined' ? window : globalThis);
