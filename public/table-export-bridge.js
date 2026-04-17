(function () {
  if (window.__ruoruoTableExporter__) {
    return;
  }

  const HIGHLIGHT_CLASS = "__ruoruo_table_exporter_active__";
  const STYLE_ID = "__ruoruo_table_exporter_style__";
  const CRC_TABLE = (() => {
    const table = new Uint32Array(256);

    for (let i = 0; i < 256; i += 1) {
      let current = i;
      for (let bit = 0; bit < 8; bit += 1) {
        current = (current & 1) ? (0xedb88320 ^ (current >>> 1)) : (current >>> 1);
      }
      table[i] = current >>> 0;
    }

    return table;
  })();

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .${HIGHLIGHT_CLASS} {
        position: relative !important;
        outline: 4px solid rgba(255, 127, 156, 0.95) !important;
        outline-offset: 6px !important;
        border-radius: 16px !important;
        box-shadow:
          0 0 0 10px rgba(255, 211, 226, 0.55),
          0 18px 42px rgba(255, 121, 157, 0.28) !important;
        transition: outline-color 180ms ease, box-shadow 180ms ease !important;
      }
    `;
    document.documentElement.appendChild(style);
  }

  function getTables() {
    return Array.from(document.querySelectorAll("table"));
  }

  function getCellCount(row) {
    if (!row) {
      return 0;
    }

    if (typeof row.cells?.length === "number") {
      return row.cells.length;
    }

    return Array.from(row.querySelectorAll("th, td")).length;
  }

  function textFromCell(cell) {
    return (cell.innerText || cell.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function escapeXml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function colToName(index) {
    let column = "";
    let value = index + 1;

    while (value > 0) {
      const remainder = (value - 1) % 26;
      column = String.fromCharCode(65 + remainder) + column;
      value = Math.floor((value - 1) / 26);
    }

    return column;
  }

  function cellRef(rowIndex, colIndex) {
    return `${colToName(colIndex)}${rowIndex + 1}`;
  }

  function normalizeCellValue(value) {
    if (value == null) {
      return "";
    }

    return String(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  }

  function getCellValue(cell) {
    const clone = cell.cloneNode(true);
    clone.querySelectorAll("script, style").forEach((node) => node.remove());
    return normalizeCellValue(clone.innerText || clone.textContent || "");
  }

  function tableToGrid(table) {
    const rows = Array.from(table.rows || []);
    const grid = [];
    const merges = [];

    rows.forEach((row, rowIndex) => {
      if (!grid[rowIndex]) {
        grid[rowIndex] = [];
      }

      let colIndex = 0;
      const cells = Array.from(row.cells || row.querySelectorAll("th, td"));

      cells.forEach((cell) => {
        while (grid[rowIndex][colIndex] !== undefined) {
          colIndex += 1;
        }

        const rowSpan = Math.max(parseInt(cell.getAttribute("rowspan") || "1", 10) || 1, 1);
        const colSpan = Math.max(parseInt(cell.getAttribute("colspan") || "1", 10) || 1, 1);
        const value = getCellValue(cell);

        for (let rowOffset = 0; rowOffset < rowSpan; rowOffset += 1) {
          const targetRow = rowIndex + rowOffset;
          if (!grid[targetRow]) {
            grid[targetRow] = [];
          }

          for (let colOffset = 0; colOffset < colSpan; colOffset += 1) {
            grid[targetRow][colIndex + colOffset] =
              rowOffset === 0 && colOffset === 0 ? value : null;
          }
        }

        if (rowSpan > 1 || colSpan > 1) {
          merges.push({
            start: cellRef(rowIndex, colIndex),
            end: cellRef(rowIndex + rowSpan - 1, colIndex + colSpan - 1)
          });
        }

        colIndex += colSpan;
      });
    });

    const maxCols = grid.reduce((max, row) => Math.max(max, row ? row.length : 0), 0);
    const normalized = grid.map((row) => {
      const nextRow = row ? row.slice() : [];
      while (nextRow.length < maxCols) {
        nextRow.push(undefined);
      }
      return nextRow;
    });

    return {
      rows: normalized,
      merges,
      maxCols
    };
  }

  function buildSheetXml(table) {
    const { rows, merges, maxCols } = tableToGrid(table);
    const rowXml = [];

    rows.forEach((row, rowIndex) => {
      const cells = [];
      row.forEach((value, colIndex) => {
        if (value === undefined || value === null || value === "") {
          return;
        }

        cells.push(
          `<c r="${cellRef(rowIndex, colIndex)}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(
            value
          )}</t></is></c>`
        );
      });

      rowXml.push(`<row r="${rowIndex + 1}">${cells.join("")}</row>`);
    });

    const dimensionRef = rows.length && maxCols ? `A1:${cellRef(rows.length - 1, maxCols - 1)}` : "A1";
    const mergeXml = merges.length
      ? `<mergeCells count="${merges.length}">${merges
          .map((merge) => `<mergeCell ref="${merge.start}:${merge.end}"/>`)
          .join("")}</mergeCells>`
      : "";

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="${dimensionRef}"/>
  <sheetViews>
    <sheetView workbookViewId="0"/>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <sheetData>${rowXml.join("")}</sheetData>
  ${mergeXml}
</worksheet>`;
  }

  function buildWorkbookXml(sheetNames) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheetNames
    .map(
      (name, index) =>
        `<sheet name="${escapeXml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
    )
    .join("")}</sheets>
</workbook>`;
  }

  function buildWorkbookRels(sheetCount) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${Array.from({ length: sheetCount }, (_, index) => {
    return `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${
      index + 1
    }.xml"/>`;
  }).join("")}
</Relationships>`;
  }

  function buildRootRels() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
  }

  function buildContentTypes(sheetCount) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${Array.from({ length: sheetCount }, (_, index) => {
    return `<Override PartName="/xl/worksheets/sheet${
      index + 1
    }.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
  }).join("")}
</Types>`;
  }

  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) {
      crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  function dateToDosTime(date) {
    const year = Math.max(date.getFullYear(), 1980);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = Math.floor(date.getSeconds() / 2);

    const dosTime = (hours << 11) | (minutes << 5) | seconds;
    const dosDate = ((year - 1980) << 9) | (month << 5) | day;

    return { dosDate, dosTime };
  }

  function writeUint16(target, offset, value) {
    target[offset] = value & 0xff;
    target[offset + 1] = (value >>> 8) & 0xff;
  }

  function writeUint32(target, offset, value) {
    target[offset] = value & 0xff;
    target[offset + 1] = (value >>> 8) & 0xff;
    target[offset + 2] = (value >>> 16) & 0xff;
    target[offset + 3] = (value >>> 24) & 0xff;
  }

  function createZip(files) {
    const encoder = new TextEncoder();
    const now = dateToDosTime(new Date());
    const localParts = [];
    const centralParts = [];
    let offset = 0;

    files.forEach((file) => {
      const nameBytes = encoder.encode(file.name);
      const dataBytes = encoder.encode(file.content);
      const crc = crc32(dataBytes);

      const localHeader = new Uint8Array(30 + nameBytes.length);
      writeUint32(localHeader, 0, 0x04034b50);
      writeUint16(localHeader, 4, 20);
      writeUint16(localHeader, 6, 0);
      writeUint16(localHeader, 8, 0);
      writeUint16(localHeader, 10, now.dosTime);
      writeUint16(localHeader, 12, now.dosDate);
      writeUint32(localHeader, 14, crc);
      writeUint32(localHeader, 18, dataBytes.length);
      writeUint32(localHeader, 22, dataBytes.length);
      writeUint16(localHeader, 26, nameBytes.length);
      writeUint16(localHeader, 28, 0);
      localHeader.set(nameBytes, 30);

      const centralHeader = new Uint8Array(46 + nameBytes.length);
      writeUint32(centralHeader, 0, 0x02014b50);
      writeUint16(centralHeader, 4, 20);
      writeUint16(centralHeader, 6, 20);
      writeUint16(centralHeader, 8, 0);
      writeUint16(centralHeader, 10, 0);
      writeUint16(centralHeader, 12, now.dosTime);
      writeUint16(centralHeader, 14, now.dosDate);
      writeUint32(centralHeader, 16, crc);
      writeUint32(centralHeader, 20, dataBytes.length);
      writeUint32(centralHeader, 24, dataBytes.length);
      writeUint16(centralHeader, 28, nameBytes.length);
      writeUint16(centralHeader, 30, 0);
      writeUint16(centralHeader, 32, 0);
      writeUint16(centralHeader, 34, 0);
      writeUint16(centralHeader, 36, 0);
      writeUint32(centralHeader, 38, 0);
      writeUint32(centralHeader, 42, offset);
      centralHeader.set(nameBytes, 46);

      localParts.push(localHeader, dataBytes);
      centralParts.push(centralHeader);
      offset += localHeader.length + dataBytes.length;
    });

    const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
    const endRecord = new Uint8Array(22);
    writeUint32(endRecord, 0, 0x06054b50);
    writeUint16(endRecord, 4, 0);
    writeUint16(endRecord, 6, 0);
    writeUint16(endRecord, 8, files.length);
    writeUint16(endRecord, 10, files.length);
    writeUint32(endRecord, 12, centralSize);
    writeUint32(endRecord, 16, offset);
    writeUint16(endRecord, 20, 0);

    return new Blob([...localParts, ...centralParts, endRecord], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function sanitizeSheetName(name, fallback) {
    const cleaned = String(name || "")
      .replace(/[\\/?*:[\]]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 31);

    return cleaned || fallback;
  }

  function buildWorkbookBlob(tables) {
    const files = [
      { name: "[Content_Types].xml", content: buildContentTypes(tables.length) },
      { name: "_rels/.rels", content: buildRootRels() },
      { name: "xl/workbook.xml", content: buildWorkbookXml(tables.map((item) => item.sheetName)) },
      { name: "xl/_rels/workbook.xml.rels", content: buildWorkbookRels(tables.length) }
    ];

    tables.forEach((item, index) => {
      files.push({
        name: `xl/worksheets/sheet${index + 1}.xml`,
        content: buildSheetXml(item.table)
      });
    });

    return createZip(files);
  }

  function summarizeTable(table, index) {
    const rows = Array.from(table.rows || []);
    const headerCells = rows[0] ? Array.from(rows[0].cells || []) : [];
    const previewCells = rows[1] ? Array.from(rows[1].cells || []) : [];

    const title =
      textFromCell(table.querySelector("caption")) ||
      headerCells.map(textFromCell).filter(Boolean).slice(0, 3).join(" / ") ||
      `表格 ${index + 1}`;

    // Use tableToGrid for accurate column count — handles colspan and ensures
    // we never report 0 when cells exist but cells.length is unreliable.
    const { maxCols } = tableToGrid(table);

    return {
      index,
      title,
      rowCount: rows.length,
      colCount: maxCols,
      preview: previewCells.map(textFromCell).filter(Boolean).slice(0, 3).join(" | ")
    };
  }

  function clearHighlight() {
    getTables().forEach((table) => {
      table.classList.remove(HIGHLIGHT_CLASS);
    });
  }

  function highlightTable(index) {
    ensureStyle();
    clearHighlight();

    const table = getTables()[index];
    if (!table) {
      return false;
    }

    table.classList.add(HIGHLIGHT_CLASS);
    table.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "nearest"
    });

    return true;
  }

  async function exportTable(index) {
    const table = getTables()[index];
    if (!table) {
      throw new Error("没有找到对应的 table");
    }
    const blob = buildWorkbookBlob([
      {
        table,
        sheetName: sanitizeSheetName(`Table${index + 1}`, `Table${index + 1}`)
      }
    ]);
    downloadBlob(blob, `table-${index + 1}.xlsx`);

    return true;
  }

  async function exportAllTables() {
    const tables = getTables();
    if (!tables.length) {
      throw new Error("当前页面没有找到 table");
    }

    tables.forEach((table, index) => {
      const blob = buildWorkbookBlob([
        {
          table,
          sheetName: sanitizeSheetName(`Table${index + 1}`, `Table${index + 1}`)
        }
      ]);
      downloadBlob(blob, `table-${index + 1}.xlsx`);
    });

    return tables.length;
  }

  function scanTables() {
    return getTables()
      .map((table, index) => {
        try {
          return summarizeTable(table, index);
        } catch (error) {
          return {
            index,
            title: `表格 ${index + 1}`,
            rowCount: typeof table.rows?.length === "number" ? table.rows.length : 0,
            colCount: 0,
            preview: "",
            error: error.message
          };
        }
      })
      .filter(Boolean);
  }

  window.__ruoruoTableExporter__ = {
    clearHighlight,
    exportAllTables,
    exportTable,
    highlightTable,
    scanTables
  };
})();
