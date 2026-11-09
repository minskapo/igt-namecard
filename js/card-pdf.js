// 인쇄용 PDF(=PDF 호환 .ai) 생성기. pdf-lib + fontkit 사용 (브라우저·Node 겸용)
(function (root) {
  const LIB = () => (typeof PDFLib !== 'undefined' ? PDFLib : require('pdf-lib'));

  // 템플릿(녹색전환연구소 명함_별색_9050.ai, 2026-11-09) 뒷면 좌표, 단위 pt, 재단선 바깥 2mm 도련 포함 페이지 기준
  // 영문 직함은 2줄 자리를 확보한 배치: 한 줄에 들어가면 1줄, 넘치면 직급/팀명으로 나눠 2줄(행간 1.2em)
  const L = {
    left: 14.1733, right: 95.8496,
    name:    { y: 131.8047, size: 8.5, track: 0 },
    titleKr: { y: 132.0186, size: 7.8, track: -20 },
    nameEn:  { y: 121.2344, size: 7.8, track: 0 },
    titleEn: { y: 121.2344, size: 7.8, track: -20, leading: 9.36, maxWidth: 150 },
    rows: [
      { label: 'MOBILE',  key: 'mobile',  y: 86.5957 },
      { label: 'TEL',     key: 'tel',     y: 75.333 },
      { label: 'E-MAIL',  key: 'email',   y: 64.0703 },
      { label: 'ADDRESS', key: 'address', y: 52.8076, valueY: 53.1406, valueSize: 7.2 }
    ],
    rowSize: 7.5, rowTrack: -20,
    // 앞면 하단 영문 기관명
    front: { text: 'Institute for Green Transformation', x: 80.9492, y: 14.6309, size: 7, track: -20 },
    // QR: 원본 템플릿 QR과 같은 자리·크기(약 8mm). 왼쪽 위 기준
    qr: { x: 229.62, top: 36.83, size: 22.65, ecc: 'M', minVersion: 3 }
  };

  const QRLIB = () => (typeof qrcode !== 'undefined' ? qrcode : require('qrcode-generator'));
  // 링크 → QR 모듈 배열. 모든 명함의 QR 밀도가 같도록 최소 버전(3, 29칸)부터 맞춤
  function qrMatrix(text) {
    const lib = QRLIB();
    let q = null;
    for (let v = L.qr.minVersion; v <= 10; v++) {
      try { q = lib(v, L.qr.ecc); q.addData(text); q.make(); break; } catch (e) { q = null; }
    }
    if (!q) { q = lib(0, L.qr.ecc); q.addData(text); q.make(); }
    const n = q.getModuleCount();
    return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => q.isDark(r, c)));
  }
  function qrOps(text, rec) {
    const { PDFOperator, PDFNumber } = LIB();
    const M = qrMatrix(text), n = M.length, m = L.qr.size / n;
    const ops = [], cts = [];
    const num = (v) => PDFNumber.of(Math.round(v * 10000) / 10000);
    M.forEach((row, r) => {
      for (let c = 0; c < n;) {
        if (!row[c]) { c++; continue; }
        const s0 = c; while (c < n && row[c]) c++;
        // 이웃 칸과 이음새가 생기지 않도록 아주 조금 겹쳐 그림
        const x = L.qr.x + s0 * m, y = L.qr.top - (r + 1) * m - 0.005, w = (c - s0) * m, h = m + 0.01;
        ops.push(PDFOperator.of('re', [num(x), num(y), num(w), num(h)]));
        cts.push([['m', x, y], ['l', x + w, y], ['l', x + w, y + h], ['l', x, y + h], ['h']]);
      }
    });
    ops.push(PDFOperator.of('f'));
    if (rec) rec.push({ contours: cts, color: '0 0 0 1 k' });
    return ops;
  }

  // 재단(90×50)·작업(92×52) 영역. 페이지 원점 기준 pt (1mm = 2.83465pt)
  const MM = 72 / 25.4;
  const BOX = {
    trim: { x: 2 * MM, y: 2 * MM, w: 90 * MM, h: 50 * MM },
    work: { x: 1 * MM, y: 1 * MM, w: 92 * MM, h: 52 * MM }
  };

  // fk: fontkit 폰트. pdfFont가 있으면 글자(텍스트)로, 없으면 아웃라인(벡터 패스)으로 그림
  function makeTextTools(doc, fk, pdfFont) {
    const { PDFOperator, PDFNumber } = LIB();
    const upm = fk.unitsPerEm;
    const N = (v) => PDFNumber.of(Math.round(v * 1000) / 1000);

    // 폰트 커닝 반영 (합자 비활성: 이메일 'fi' 등 방지)
    function measure(text, size, track) {
      const run = fk.layout(text, { liga: false, clig: false, dlig: false });
      let w = 0;
      run.positions.forEach((p, i) => { w += p.xAdvance; if (i < run.positions.length - 1) w += track * upm / 1000; });
      return { run, width: w / upm * size };
    }

    function textOps(key, text, x, y, size, track) {
      if (!text) return [];
      const chars = Array.from(text);
      const { run } = measure(text, size, track);
      const sameLen = run.glyphs.length === chars.length;
      const arr = doc.context.obj([]);
      chars.forEach((ch, i) => {
        arr.push(pdfFont.encodeText(ch));
        if (sameLen && i < chars.length - 1) {
          const g = run.glyphs[i], p = run.positions[i];
          const kern = (p.xAdvance - g.advanceWidth) * 1000 / upm; // 음수=당김
          if (Math.abs(kern) > 0.01) arr.push(PDFNumber.of(-kern));
        }
      });
      return [
        PDFOperator.of('BT'),
        PDFOperator.of('Tf', [key, PDFNumber.of(size)]),
        PDFOperator.of('Tc', [PDFNumber.of(track / 1000 * size)]),
        PDFOperator.of('Td', [PDFNumber.of(x), PDFNumber.of(y)]),
        PDFOperator.of('TJ', [arr]),
        PDFOperator.of('ET')
      ];
    }

    // 글리프 외곽선 → 윤곽선 목록(PDF 좌표). [['m',x,y],['l',x,y],['c',x1,y1,x2,y2,x3,y3],['h']]
    function contours(text, x, y, size, track) {
      if (!text) return [];
      const { run } = measure(text, size, track);
      const sc = size / upm, out = [];
      let pen = x;
      run.glyphs.forEach((g, i) => {
        const pos = run.positions[i];
        const ox = pen + pos.xOffset * sc, oy = y + pos.yOffset * sc;
        const T = (gx, gy) => [ox + gx * sc, oy + gy * sc];
        let cur = null, cx = 0, cy = 0, sx = 0, sy = 0;
        for (const c of g.path.commands) {
          const a = c.args;
          if (c.command === 'moveTo') { cur = [['m', ...T(a[0], a[1])]]; out.push(cur); cx = sx = a[0]; cy = sy = a[1]; }
          else if (c.command === 'lineTo') { cur.push(['l', ...T(a[0], a[1])]); cx = a[0]; cy = a[1]; }
          else if (c.command === 'quadraticCurveTo') {
            const [qx, qy, ex, ey] = a;
            cur.push(['c', ...T(cx + 2 / 3 * (qx - cx), cy + 2 / 3 * (qy - cy)), ...T(ex + 2 / 3 * (qx - ex), ey + 2 / 3 * (qy - ey)), ...T(ex, ey)]);
            cx = ex; cy = ey;
          } else if (c.command === 'bezierCurveTo') { cur.push(['c', ...T(a[0], a[1]), ...T(a[2], a[3]), ...T(a[4], a[5])]); cx = a[4]; cy = a[5]; }
          else if (c.command === 'closePath') { cur.push(['h']); cx = sx; cy = sy; }
        }
        pen += pos.xAdvance * sc + track / 1000 * size;
      });
      return out;
    }
    function contourOps(cts) {
      const ops = [];
      for (const ct of cts) for (const s of ct) {
        if (s[0] === 'm') ops.push(PDFOperator.of('m', [N(s[1]), N(s[2])]));
        else if (s[0] === 'l') ops.push(PDFOperator.of('l', [N(s[1]), N(s[2])]));
        else if (s[0] === 'c') ops.push(PDFOperator.of('c', s.slice(1).map(N)));
        else ops.push(PDFOperator.of('h'));
      }
      if (ops.length) ops.push(PDFOperator.of('f'));
      return ops;
    }
    function outlineOps(text, x, y, size, track, rec) {
      const cts = contours(text, x, y, size, track);
      if (rec && cts.length) rec.push({ contours: cts, color: '0 0 0 1 k' });
      return contourOps(cts);
    }
    return { measure, textOps, outlineOps, contourOps };
  }

  function titleEnLines(tools, text) {
    const t = L.titleEn;
    if (!text) return [];
    if (tools.measure(text, t.size, t.track).width <= t.maxWidth || !text.includes(', ')) return [text];
    const k = text.indexOf(', ');
    return [text.slice(0, k + 1), text.slice(k + 2)];
  }

  function drawFront(doc, page, fk, pdfFont, rec) {
    const { PDFOperator, PDFNumber } = LIB();
    const tools = makeTextTools(doc, fk, pdfFont);
    const t = L.front;
    const key = pdfFont ? page.node.newFontDictionary(pdfFont.name, pdfFont.ref) : null;
    page.pushOperators(PDFOperator.of('q'), PDFOperator.of('k', [0, 0, 0, 1].map((v) => PDFNumber.of(v))),
      ...(pdfFont ? tools.textOps(key, t.text, t.x, t.y, t.size, t.track) : tools.outlineOps(t.text, t.x, t.y, t.size, t.track, rec)),
      PDFOperator.of('Q'));
  }

  function drawBack(doc, page, fk, pdfFont, p, rec) {
    const { PDFOperator, PDFNumber } = LIB();
    const tools = makeTextTools(doc, fk, pdfFont);
    const key = pdfFont ? page.node.newFontDictionary(pdfFont.name, pdfFont.ref) : null;
    const ops = [PDFOperator.of('q'), PDFOperator.of('k', [0, 0, 0, 1].map((v) => PDFNumber.of(v)))];
    const add = (t, x, y, size, track) =>
      ops.push(...(pdfFont ? tools.textOps(key, t, x, y, size, track) : tools.outlineOps(t, x, y, size, track, rec)));
    add(p.name, L.left, L.name.y, L.name.size, L.name.track);
    add(p.titleKr, L.right, L.titleKr.y, L.titleKr.size, L.titleKr.track);
    add(p.nameEn, L.left, L.nameEn.y, L.nameEn.size, L.nameEn.track);
    titleEnLines(tools, p.titleEn).forEach((line, i) =>
      add(line, L.right, L.titleEn.y - i * L.titleEn.leading, L.titleEn.size, L.titleEn.track));
    L.rows.forEach((r) => {
      add(r.label, L.left, r.y, L.rowSize, L.rowTrack);
      add(p[r.key], L.right, r.valueY || r.y, r.valueSize || L.rowSize, L.rowTrack);
    });
    if (p.qrText) ops.push(...qrOps(p.qrText, rec));
    ops.push(PDFOperator.of('Q'));
    page.pushOperators(...ops);
  }

  // 페이지를 작업 사이즈(92×52, 사방 1mm 도련)로 맞추고 재단선(90×50) 정보 지정
  function setBoxes(page) {
    const w = BOX.work, t = BOX.trim;
    page.setMediaBox(w.x, w.y, w.w, w.h);
    page.setCropBox(w.x, w.y, w.w, w.h);
    page.setBleedBox(w.x, w.y, w.w, w.h);
    page.setTrimBox(t.x, t.y, t.w, t.h);
    page.setArtBox(t.x, t.y, t.w, t.h);
  }
  // 92×52·90×50 투명 박스(면·선 모두 불투명도 0). 인쇄되지 않고 크기 기준만 남김
  function guideBoxOps(doc, page) {
    const { PDFOperator, PDFNumber, PDFName } = LIB();
    const gs = doc.context.register(doc.context.obj({ Type: 'ExtGState', CA: 0, ca: 0 }));
    const key = page.node.newExtGState('GSbox', gs);
    const N = (v) => PDFNumber.of(Math.round(v * 1000) / 1000);
    const rect = (b) => PDFOperator.of('re', [N(b.x), N(b.y), N(b.w), N(b.h)]);
    return [
      PDFOperator.of('q'), PDFOperator.of('gs', [key]),
      PDFOperator.of('w', [PDFNumber.of(0.25)]), PDFOperator.of('K', [0, 0, 0, 1].map((v) => PDFNumber.of(v))),
      rect(BOX.work), PDFOperator.of('S'),
      rect(BOX.trim), PDFOperator.of('S'),
      PDFOperator.of('Q')
    ];
  }


  // 아트보드(페이지)의 모든 내용을 하나의 그룹으로: 페이지 내용 전체를 폼 XObject(투명도 그룹) 하나로 옮김.
  // Illustrator 등에서 열면 아트보드마다 그룹 1개(배경·글자·QR·투명 박스 포함)로 들어옴
  function groupPage(doc, page) {
    const { PDFName, PDFArray, PDFRawStream, PDFContentStream, decodePDFRawStream, PDFOperator } = LIB();
    const ctx = doc.context;
    const node = page.node;
    const raw = node.get(PDFName.of('Contents'));
    const list = [];
    const take = (ref) => {
      const obj = ctx.lookup(ref);
      if (obj instanceof PDFArray) { for (let i = 0; i < obj.size(); i++) take(obj.get(i)); return; }
      if (obj instanceof PDFContentStream) list.push(obj.getUnencodedContents());
      else if (obj instanceof PDFRawStream) list.push(decodePDFRawStream(obj).decode());
    };
    take(raw);
    const parts = [];
    list.forEach((u) => { parts.push(u); parts.push(new Uint8Array([10])); });
    const total = parts.reduce((n, u) => n + u.length, 0);
    const bytes = new Uint8Array(total);
    let o = 0; parts.forEach((u) => { bytes.set(u, o); o += u.length; });
    const mb = page.getMediaBox();
    const form = ctx.flateStream(bytes, {
      Type: 'XObject', Subtype: 'Form',
      BBox: [mb.x, mb.y, mb.x + mb.width, mb.y + mb.height],
      Resources: node.get(PDFName.of('Resources')),
      Group: { Type: 'Group', S: 'Transparency' }
    });
    const formRef = ctx.register(form);
    node.set(PDFName.of('Resources'), ctx.obj({ XObject: { Artboard: formRef } }));
    const content = PDFContentStream.of(ctx.obj({}), [PDFOperator.of('q'), PDFOperator.of('Do', [PDFName.of('Artboard')]), PDFOperator.of('Q')]);
    node.set(PDFName.of('Contents'), ctx.register(content));
  }

  // people: [{name,titleKr,nameEn,titleEn,mobile,tel,email,address,qrText}] → Uint8Array (PDF 1.6, .ai로 저장 가능)
  // opts.outline: true면 글자를 아웃라인(패스)으로, false면 서체를 넣은 텍스트로
  async function buildCards(baseBytes, fontBytes, people, fontkitLib, opts) {
    const { PDFDocument } = LIB();
    const outline = !opts || opts.outline !== false;
    const base = await PDFDocument.load(baseBytes);
    const out = await PDFDocument.create();
    out.registerFontkit(fontkitLib);
    let pdfFont = null, fk;
    if (outline) fk = fontkitLib.create(new Uint8Array(fontBytes));
    else { pdfFont = await out.embedFont(fontBytes, { subset: false }); fk = pdfFont.embedder.font; }
    // 한 번에 복사해야 ICC 프로필·로고 등 공통 리소스가 한 벌만 들어감
    const pages = await out.copyPages(base, people.flatMap(() => [0, 1]));
    const aiPages = [];
    for (const [i, p] of people.entries()) {
      const front = pages[i * 2], back = pages[i * 2 + 1];
      out.addPage(front);
      out.addPage(back);
      const fRec = [], bRec = [];
      drawFront(out, front, fk, pdfFont, fRec);
      drawBack(out, back, fk, pdfFont, p, bRec);
      for (const pg of [front, back]) { setBoxes(pg); pg.pushOperators(...guideBoxOps(out, pg)); groupPage(out, pg); }
      const no = String(i + 1).padStart(2, '0'), id = String(p.email || '').split('@')[0] || no;
      aiPages.push({ side: 'front', name: `${no}_${p.name}_앞면`, abName: `${no}_${id}_front`, items: fRec, boxes: [BOX.work, BOX.trim] });
      aiPages.push({ side: 'back', name: `${no}_${p.name}_뒷면`, abName: `${no}_${id}_back`, items: bRec, boxes: [BOX.work, BOX.trim] });
    }
    // 아웃라인 파일에는 Illustrator 편집 데이터를 넣어 아트보드·레이어·그룹이 그대로 열리게 함
    // (글자 편집용은 서체 텍스트를 살리기 위해 PDF 내용만 둠: Illustrator 편집 데이터는 글자를 아웃라인으로만 담을 수 있음)
    if (outline && opts && opts.editingData !== false) {
      const AI = typeof CardAI !== 'undefined' ? CardAI : require('./card-ai.js');
      await AI.attach(out, AI.buildPrivateText(aiPages, '녹색전환연구소 명함'));
    }
    const names = people.map((p) => p.name).join(', ');
    out.setTitle('녹색전환연구소 명함 – ' + names);
    out.setCreator('IGT 명함 생성기');
    out.setProducer('IGT 명함 생성기 (pdf-lib)');
    return out.save({ useObjectStreams: false });
  }

  const api = { buildCards, qrMatrix, LAYOUT: L, BOX };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CardPDF = api;
})(typeof window !== 'undefined' ? window : globalThis);
