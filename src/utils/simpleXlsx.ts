function crc32Table(): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i;
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[i] = crc >>> 0;
  }
  return table;
}

const CRC_TABLE = crc32Table();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function u16(value: number): Uint8Array {
  return Uint8Array.of(value & 0xff, (value >>> 8) & 0xff);
}

function u32(value: number): Uint8Array {
  return Uint8Array.of(
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff
  );
}

/** ZIP with STORE (no compression). Valid for .xlsx. */
export function zipStore(files: { path: string; data: Uint8Array }[]): Uint8Array {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = encoder.encode(file.path);
    const crc = crc32(file.data);
    const size = file.data.length;

    const local = concat([
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(size),
      u32(size),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
      file.data,
    ]);
    locals.push(local);

    centrals.push(
      concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(size),
        u32(size),
        u16(nameBytes.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        nameBytes,
      ])
    );

    offset += local.length;
  }

  const centralDir = concat(centrals);
  const eocd = concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralDir.length),
    u32(offset),
    u16(0),
  ]);

  return concat([...locals, centralDir, eocd]);
}

export const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type SimpleXlsxCell = string | number | null;

export type SimpleXlsxSheet = {
  name: string;
  headers: string[];
  rows: SimpleXlsxCell[][];
};

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sanitizeCellText(value: string): string {
  const flat = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/\r\n|\r|\n/g, " ").trim();
  if (/^[=+\-@]/.test(flat)) return `'${flat}`;
  return flat;
}

function colLetter(index: number): string {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function inlineStrCell(ref: string, value: string, style?: number): string {
  const styleAttr = style != null ? ` s="${style}"` : "";
  return `<c r="${ref}" t="inlineStr"${styleAttr}><is><t>${escapeXml(sanitizeCellText(value))}</t></is></c>`;
}

function numberCell(ref: string, value: number, style?: number): string {
  const styleAttr = style != null ? ` s="${style}"` : "";
  return `<c r="${ref}"${styleAttr}><v>${value}</v></c>`;
}

function sheetXml(sheet: SimpleXlsxSheet): string {
  const colCount = Math.max(sheet.headers.length, 1);
  const headerCells = sheet.headers
    .map((header, index) => inlineStrCell(`${colLetter(index)}1`, header, 1))
    .join("");
  const body = sheet.rows
    .map((row, rowIndex) => {
      const r = rowIndex + 2;
      const cells = row
        .map((value, colIndex) => {
          const ref = `${colLetter(colIndex)}${r}`;
          if (value == null || value === "") return "";
          if (typeof value === "number" && Number.isFinite(value)) return numberCell(ref, value);
          return inlineStrCell(ref, String(value));
        })
        .join("");
      return `<row r="${r}">${cells}</row>`;
    })
    .join("");

  const cols = `<cols><col min="1" max="${colCount}" width="22" customWidth="1"/></cols>`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews>
    <sheetView workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  ${cols}
  <sheetData>
    <row r="1">${headerCells}</row>
    ${body}
  </sheetData>
</worksheet>`;
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF1D63ED"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
  </cellXfs>
</styleSheet>`;

function contentTypesXml(sheetCount: number): string {
  const sheetOverrides = Array.from({ length: sheetCount }, (_, i) => {
    const n = i + 1;
    return `<Override PartName="/xl/worksheets/sheet${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheetOverrides}
</Types>`;
}

function workbookXml(sheets: SimpleXlsxSheet[]): string {
  const sheetTags = sheets
    .map((sheet, i) => {
      const name = escapeXml(sheet.name.slice(0, 31));
      return `<sheet name="${name}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
 xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <bookViews>
    <workbookView activeTab="0"/>
  </bookViews>
  <sheets>${sheetTags}</sheets>
</workbook>`;
}

function workbookRelsXml(sheetCount: number): string {
  const sheetRels = Array.from({ length: sheetCount }, (_, i) => {
    const n = i + 1;
    return `<Relationship Id="rId${n}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${n}.xml"/>`;
  }).join("");
  const stylesId = `rId${sheetCount + 1}`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheetRels}
  <Relationship Id="${stylesId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;

function utf8(xml: string): Uint8Array {
  return new TextEncoder().encode(xml);
}

export function buildSimpleXlsx(sheets: SimpleXlsxSheet[]): Uint8Array {
  if (sheets.length === 0) {
    throw new Error("A planilha precisa de ao menos uma aba.");
  }

  const files: { path: string; data: Uint8Array }[] = [
    { path: "[Content_Types].xml", data: utf8(contentTypesXml(sheets.length)) },
    { path: "_rels/.rels", data: utf8(ROOT_RELS) },
    { path: "xl/workbook.xml", data: utf8(workbookXml(sheets)) },
    { path: "xl/_rels/workbook.xml.rels", data: utf8(workbookRelsXml(sheets.length)) },
    { path: "xl/styles.xml", data: utf8(STYLES_XML) },
  ];

  sheets.forEach((sheet, index) => {
    files.push({
      path: `xl/worksheets/sheet${index + 1}.xml`,
      data: utf8(sheetXml(sheet)),
    });
  });

  return zipStore(files);
}
