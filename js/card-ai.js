// Illustrator 편집 데이터(AI private data) 생성: 아트보드마다 레이어 1개 + 그룹 1개(배경·로고·글자·QR·투명 박스)
// Illustrator·VectorCraft는 .ai를 열 때 이 데이터를 읽어 아트보드·레이어·그룹을 그대로 복원한다.
(function (root) {
  const DATA = () => (typeof CardAIData !== 'undefined' ? CardAIData : require('./card-ai-data.js'));
  const MM = 72 / 25.4;
  // Illustrator 관례대로 아트보드 = 재단 크기(90×50), 사방 2mm 도련(94×54)
  // 아트보드 = 재단 90×50, 문서 도련 2mm(94×54). Illustrator 30.8에서 도련 설정 유지 확인
  const W = 90 * MM, H = 50 * MM, GAP = 36;
  const PX = 2 * MM, PY = 2 * MM + H;
  const FX = -1 * MM, FY = 1 * MM;
  const BLEED = 2 * MM;              // 고정 아트 조각(92×52 기준) → 재단선 기준
  const COORD = new Set(['m', 'l', 'L', 'c', 'C', 'v', 'V', 'y', 'Y']);
  const f = (v) => { const s = (Math.round(v * 10000) / 10000).toString(); return s === '-0' ? '0' : s; };

  // UTF-8 바이트를 AI 문자열 리터럴로 (비ASCII는 8진 이스케이프)
  function aiStr(s) {
    const b = new TextEncoder().encode(String(s));
    let out = '';
    for (const c of b) {
      if (c === 40 || c === 41 || c === 92) out += '\\' + String.fromCharCode(c);
      else if (c >= 32 && c < 127) out += String.fromCharCode(c);
      else out += '\\' + c.toString(8).padStart(3, '0');
    }
    return '(' + out + ')';
  }

  // 고정 아트 조각: 좌표에 아트보드 x 오프셋을 더해 문자열로
  function fragText(objs, dx) {
    const lines = [];
    for (const o of objs) for (const l of o) {
      if (Array.isArray(l)) {
        const [op, ...n] = l;
        lines.push(n.map((v, i) => f(i % 2 === 0 ? v + dx + FX : v + FY)).join(' ') + ' ' + op);
      } else lines.push(l);
    }
    return lines.join('\n');
  }

  // 윤곽선(PDF 좌표) → AI 컴파운드 패스. contours: [[['m',x,y],['l',x,y],['c',x1,y1,x2,y2,x3,y3],['h']], …]
  function compoundText(contours, color, dx) {
    if (!contours.length) return '';
    const P = (x, y) => f(dx + x - PX) + ' ' + f(y - PY);
    const out = [color, '0 O', '0 XR', '*u'];
    // Illustrator가 읽을 때 마지막 변이 빠지지 않도록, 각 윤곽선 끝에 시작점을 명시적으로 다시 찍어 닫음
    for (const ct of contours) {
      let sx = null, sy = null, ex = null, ey = null;
      for (const s of ct) {
        if (s[0] === 'm') { out.push(P(s[1], s[2]) + ' m'); sx = ex = s[1]; sy = ey = s[2]; }
        else if (s[0] === 'l') { out.push(P(s[1], s[2]) + ' L'); ex = s[1]; ey = s[2]; }
        else if (s[0] === 'c') { out.push(P(s[1], s[2]) + ' ' + P(s[3], s[4]) + ' ' + P(s[5], s[6]) + ' C'); ex = s[5]; ey = s[6]; }
      }
      if (sx !== null && (Math.abs(ex - sx) > 1e-6 || Math.abs(ey - sy) > 1e-6)) out.push(P(sx, sy) + ' L');
      out.push('f');
    }
    out.push('*U');
    return out.join('\n');
  }

  // 칠·선 없는 투명 박스 (PDF 좌표 x,y,w,h)
  function boxText(b, dx) {
    const P = (x, y) => f(dx + x - PX) + ' ' + f(y - PY);
    return ['0 O', '0 XR', P(b.x, b.y) + ' m', P(b.x + b.w, b.y) + ' L', P(b.x + b.w, b.y + b.h) + ' L', P(b.x, b.y + b.h) + ' L', P(b.x, b.y) + ' L', 'n'].join('\n');
  }

  // pages: [{name, side:'front'|'back', items:[{contours, color}], boxes:[{x,y,w,h}]}]
  function buildPrivateText(pages, title) {
    const D = DATA();
    const n = pages.length, totalW = n * W + (n - 1) * GAP;
    const ox = 8191.5 - totalW / 2, oy = 8191.5 - H / 2;
    const now = new Date();
    const hdr = [
      '%!PS-Adobe-3.0',
      '%%Creator: IGT namecard generator, editing data for Illustrator',
      '%%AI8_CreatorVersion: 30.7.0',
      '%%For: () ()',
      '%%Title: ' + aiStr(title || 'IGT namecard'),
      `%%CreationDate: (${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()}) (${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')})`,
      '%%Canvassize: 16383',
      `%%BoundingBox: 0 ${-Math.ceil(H)} ${Math.ceil(totalW)} 0`,
      `%%HiResBoundingBox: 0 ${f(-H)} ${f(totalW)} 0`,
      '%%DocumentProcessColors: Cyan Magenta Yellow Black',
      '%AI5_FileFormat 14.0',
      '%AI3_ColorUsage: Color',
      '%AI7_ImageSettings: 0',
      '%%DocumentCustomColors: (PANTONE 909 C)',
      '%%CMYKCustomColor: 0.443 0 0.7095 0 (PANTONE 909 C)',
      `%AI3_Cropmarks: 0 ${f(-H)} ${f(W)} 0`,
      `%AI3_TemplateBox: ${f(totalW / 2)} ${f(-H / 2)} ${f(totalW / 2)} ${f(-H / 2)}`,
      `%AI3_TileBox: 0 ${f(-H)} ${f(W)} 0`,
      '%AI3_DocumentPreview: None',
      '%AI5_ArtSize: 14400 14400',
      '%AI5_RulerUnits: 1',
      '%AI24_LargeCanvasScale: 1',
      '%AI9_ColorModel: 2',
      '%AI5_ArtFlags: 0 0 0 1 0 0 1 0 0',
      '%AI5_TargetResolution: 800',
      '%AI5_NumLayers: ' + n,
      '%AI5_OpenViewLayers: ' + '7'.repeat(Math.min(n, 64)),
      '%AI7_GridSettings: 72 8 72 8 1 0 0.7843 0.7843 0.7843 0.7843 0.7843 0.7843'
    ].join('\n') + '\n';

    const abs = pages.map((pg, i) => {
      const x1 = i * (W + GAP);
      return ['%_/Dictionary :',
        `%_${f(x1)} 0 /RealPointRelToROrigin`, '%_ (PositionPoint1) ,',
        `%_${f(x1 + W)} ${f(-H)} /RealPointRelToROrigin`, '%_ (PositionPoint2) ,',
        `%_${f(x1 + ox)} ${f(oy)} /RealPoint`, '%_ (RulerOrigin) ,',
        '%_1 /Real (PAR) ,', '%_0 /Int (DisplayMark) ,',
        `%_${i === 0 ? 1 : 0} /Bool (IsArtboardSelected) ,`, '%_0 /Bool (IsArtboardDefaultName) ,', '%_0 /Bool (IsArtboardLocked) ,',
        `%_${aiStr(pg.abName)} /UnicodeString (Name) ,`, '%_; ,'].join('\n');
    }).join('\n');
    const doc = ['%AI9_BeginDocumentData', '%_/Document :', '%_/Dictionary :', '%_/Array :', abs,
      '%_; (ArtboardArray) ,', '%_0 /Int (CropAreaActive) ,',
      `%_${f(BLEED)} /Real (BleedLeftValue) ,`, `%_${f(BLEED)} /Real (BleedTopValue) ,`,
      `%_${f(BLEED)} /Real (BleedRightValue) ,`, `%_${f(BLEED)} /Real (BleedBottomValue) ,`,
      '%_16383 /Int (AIDocumentCanvasSize) ,', '%_; /Recorded ,',
      '%_/Dictionary : /NotRecorded ,', '%_; /NotRecorded ,', '%_;', '%AI9_EndDocumentData', '%%EndSetup'].join('\n');

    const layers = pages.map((pg, i) => {
      const dx = i * (W + GAP);
      const art = [fragText(D.frag[pg.side], dx)];
      for (const it of pg.items) art.push(compoundText(it.contours, it.color || '0 0 0 1 k', dx));
      for (const b of pg.boxes) art.push(boxText(b, dx));
      return ['%AI5_BeginLayer',
        `1 1 1 1 0 0 ${i % 9} 0 79 128 255 0 50 0 Lb`,
        `${aiStr(pg.name)} Ln`,
        '0 A', '0 Xw',
        'u', ...art.filter(Boolean), 'U',
        'LB', '%AI5_EndLayer--'].join('\n');
    }).join('\n');

    return hdr + D.pal + doc + '\n' + layers + '\n%%PageTrailer\ngsave annotatepage grestore showpage\n%%Trailer\n%%EOF\n';
  }

  // Zstandard 프레임(무압축 Raw 블록). Illustrator 최신 형식(%AI24_ZStandard_Data)과 같은 컨테이너
  function zstdRaw(bytes) {
    const n = bytes.length, BLK = 131072;
    const nb = Math.max(1, Math.ceil(n / BLK));
    const out = new Uint8Array(4 + 1 + 8 + nb * 3 + n);
    let o = 0;
    out.set([0x28, 0xB5, 0x2F, 0xFD], o); o += 4;
    out[o++] = 0xE0;                                   // 단일 세그먼트, 원본 크기 8바이트
    let sz = n; for (let i = 0; i < 8; i++) { out[o++] = sz % 256; sz = Math.floor(sz / 256); }
    for (let k = 0; k < nb; k++) {
      const part = bytes.subarray(k * BLK, Math.min(n, (k + 1) * BLK));
      const h = (part.length << 3) | (0 << 1) | (k === nb - 1 ? 1 : 0);
      out[o++] = h & 255; out[o++] = (h >> 8) & 255; out[o++] = (h >> 16) & 255;
      out.set(part, o); o += part.length;
    }
    return out;
  }

  // PDF 문서의 모든 페이지에 Illustrator 편집 데이터(PieceInfo)를 붙임
  async function attach(pdfDoc, text) {
    const { PDFName, PDFString, PDFRawStream } = (typeof PDFLib !== 'undefined' ? PDFLib : require('pdf-lib'));
    const ctx = pdfDoc.context;
    const enc = new TextEncoder();
    const body = enc.encode(text);
    const meta = enc.encode(text.slice(0, text.indexOf('%%EndComments') >= 0 ? text.indexOf('%%EndComments') : text.indexOf('%AI5_BeginPalette')) + '%%EndComments\n');
    const tag = enc.encode('%AI24_ZStandard_Data');
    const z = zstdRaw(body);
    const all = new Uint8Array(tag.length + z.length); all.set(tag); all.set(z, tag.length);
    const metaRef = ctx.register(PDFRawStream.of(ctx.obj({ Length: meta.length }), meta));
    const CH = 65536, blocks = [];
    for (let i = 0; i < all.length; i += CH) {
      const part = all.subarray(i, Math.min(all.length, i + CH));
      blocks.push(ctx.register(PDFRawStream.of(ctx.obj({ Length: part.length }), part)));
    }
    const d = new Date();
    const stamp = `D:${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}${String(d.getUTCHours()).padStart(2, '0')}${String(d.getUTCMinutes()).padStart(2, '0')}${String(d.getUTCSeconds()).padStart(2, '0')}+00'00'`;
    const privDict = { AIMetaData: metaRef, ContainerVersion: 12, CreatorVersion: 30, NumBlock: blocks.length, RoundtripStreamType: 2, RoundtripVersion: 24 };
    blocks.forEach((r, i) => { privDict['AIPrivateData' + (i + 1)] = r; });
    const privRef = ctx.register(ctx.obj(privDict));
    // /Illustrator 사전은 반드시 간접 객체로 두어야 Illustrator가 파일을 열 때 'PDF 가져오기' 대신 .ai 원본으로 연다
    const illRef = ctx.register(ctx.obj({ LastModified: PDFString.of(stamp), Private: privRef }));
    for (const page of pdfDoc.getPages()) {
      page.node.set(PDFName.of('PieceInfo'), ctx.obj({ Illustrator: illRef }));
      page.node.set(PDFName.of('LastModified'), PDFString.of(stamp));
    }
  }

  const api = { buildPrivateText, attach, aiStr, zstdRaw };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.CardAI = api;
})(typeof window !== 'undefined' ? window : globalThis);
