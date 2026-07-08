(function () {
  const BRIDGE_VERSION = '2026-07-08-toutiao-v1';
  if (window.__ruoruoToutiaoPublisher__?.version === BRIDGE_VERSION) return;

  const ALLOWED_ALIGN = new Set(['left', 'center', 'right']);

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getTitleInput() {
    return document.querySelector('.publish-editor-title textarea');
  }

  function getContentEditor() {
    return document.querySelector('.syl-editor .ProseMirror[contenteditable="true"]');
  }

  function isNodeVisible(node) {
    if (!node) return false;
    const style = window.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function isToutiaoEditor() {
    return !!(getTitleInput() && getContentEditor());
  }

  function validatePayload(payload) {
    if (!payload || typeof payload !== 'object') throw new Error('payload 格式无效');
    if (!Array.isArray(payload.title_candidates) || payload.title_candidates.length !== 3) {
      throw new Error('新版协议要求 title_candidates 必须提供 3 个标题');
    }
    if (!Array.isArray(payload.blocks)) {
      throw new Error('新版协议要求 blocks 必须是数组');
    }
  }

  function fillTextareaValue(node, value) {
    if (!node) throw new Error('未找到标题输入框');
    node.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    if (setter) setter.call(node, value || '');
    else node.value = value || '';
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
    node.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));
    node.blur();
  }

  function clearContentEditor() {
    const editor = getContentEditor();
    if (!editor) throw new Error('未找到正文编辑器');
    editor.replaceChildren();
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    editor.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function moveCursorToEditorEnd(editor) {
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function createLeafSpan(text, styleText) {
    const span = document.createElement('span');
    span.setAttribute('style', styleText);
    span.textContent = text || '';
    return span;
  }

  function normalizeSegmentMarks(segment) {
    const marks = Array.isArray(segment?.marks) ? segment.marks : [];
    return marks.map((mark) => String(mark || '').trim()).filter(Boolean);
  }

  function getSegmentStyle(baseStyle, marks) {
    let style = baseStyle;
    if (marks.includes('bold')) style += 'font-weight:700;';
    return style;
  }

  function getParagraphAlign(block) {
    const align = String(block?.align || '').trim().toLowerCase();
    return ALLOWED_ALIGN.has(align) ? align : '';
  }

  function createParagraph(block) {
    const section = document.createElement('section');
    section.setAttribute('style', 'margin:0 0 20px 0;');
    const p = document.createElement('p');
    p.setAttribute('class', 'pgc-p');
    const align = getParagraphAlign(block);
    p.setAttribute('style', `margin:0;${align ? `text-align:${align};` : ''}`);
    const baseStyle = 'font-size:15px; line-height:1.85; color:rgba(0,0,0,.9);';
    const segments = Array.isArray(block.segments) ? block.segments : [];
    if (segments.length) {
      segments.forEach((segment) => {
        const text = String(segment?.text || '');
        if (!text) return;
        p.appendChild(createLeafSpan(text, getSegmentStyle(baseStyle, normalizeSegmentMarks(segment))));
      });
    } else {
      p.appendChild(createLeafSpan(String(block.text || ''), baseStyle));
    }
    section.appendChild(p);
    return section;
  }

  function createHeading(block) {
    const heading = document.createElement('h1');
    heading.textContent = String(block.text || '');
    heading.setAttribute('class', 'pgc-h-forward-slash');
    heading.setAttribute('spellcheck', 'false');
    return heading;
  }

  function createBlockquote(block) {
    const quote = document.createElement('blockquote');
    const p = document.createElement('p');
    p.textContent = String(block.text || '');
    quote.appendChild(p);
    return quote;
  }

  function createBulletList(block) {
    const list = document.createElement('ul');
    const items = Array.isArray(block.items) ? block.items : [];
    items.forEach((itemText) => {
      const li = document.createElement('li');
      li.textContent = String(itemText ?? '');
      list.appendChild(li);
    });
    return list;
  }

  function createNumberedList(block) {
    const list = document.createElement('ol');
    list.setAttribute('start', '1');
    const items = Array.isArray(block.items) ? block.items : [];
    items.forEach((itemText) => {
      const li = document.createElement('li');
      li.textContent = String(itemText ?? '');
      list.appendChild(li);
    });
    return list;
  }

  function createDivider() {
    return document.createElement('hr');
  }

  function createTableCell(text) {
    const td = document.createElement('td');
    const p = document.createElement('p');
    if (text) {
      p.textContent = text;
    } else {
      p.appendChild(document.createElement('br'));
    }
    td.appendChild(p);
    return td;
  }

  function createTable(block) {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('class', 'tableWrapper');
    const table = document.createElement('table');
    const tbody = document.createElement('tbody');
    const headers = Array.isArray(block.headers) ? block.headers : [];
    const rows = Array.isArray(block.rows) ? block.rows : [];
    const totalCols = Math.max(headers.length, ...rows.map((row) => (Array.isArray(row) ? row.length : 0)), 1);

    const mergedRows = [];
    if (headers.length) mergedRows.push(headers);
    mergedRows.push(...rows);

    mergedRows.forEach((row) => {
      const tr = document.createElement('tr');
      for (let i = 0; i < totalCols; i += 1) {
        tr.appendChild(createTableCell(String((Array.isArray(row) ? row[i] : '') ?? '')));
      }
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    wrapper.appendChild(table);
    return wrapper;
  }

  function getImageSourceText(block) {
    const sourceName = String(block?.source_name || '').trim();
    const sourcePage = String(block?.source_page || '').trim();
    let sourceText = sourceName;
    if (!sourceText && sourcePage) {
      try {
        sourceText = new URL(sourcePage).hostname.replace(/^www\./i, '') || sourcePage;
      } catch (_error) {
        sourceText = sourcePage;
      }
    }
    if (!sourceText) sourceText = '网络';
    return `（图片来源：${sourceText}）`;
  }

  function fillImageCaption(wrapper, text) {
    if (!wrapper || !text) return false;
    const input = wrapper.querySelector('textarea.pgc-img-caption-ipt');
    if (!input) return false;

    input.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    if (setter) setter.call(input, text);
    else input.value = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.blur();

    const displayNodes = wrapper.querySelectorAll('.pgc-img-caption');
    displayNodes.forEach((node) => {
      node.textContent = text;
    });
    return true;
  }

  function createBottomImageHint() {
    const section = document.createElement('section');
    section.setAttribute('style', 'margin:14px 0 0 0;');
    section.setAttribute('data-ruo-image-footer-note', 'true');
    const p = document.createElement('p');
    p.setAttribute('style', 'margin:0; text-align:center; font-size:12px; line-height:1.7; color:#9ca3af;');
    p.textContent = '提示：正文图片来源于网络，侵权请联系删除';
    section.appendChild(p);
    return section;
  }

  function renderBlock(block) {
    switch (block.type) {
      case 'heading':
        return createHeading(block);
      case 'blockquote':
        return createBlockquote(block);
      case 'bullet_list':
        return createBulletList(block);
      case 'numbered_list':
        return createNumberedList(block);
      case 'divider':
        return createDivider();
      case 'table':
        return createTable(block);
      case 'paragraph':
      default:
        return createParagraph(block);
    }
  }

  function getImageToolbarButton() {
    return document.querySelector('.syl-toolbar-tool.image button, .syl-toolbar-tool.image .syl-toolbar-button');
  }

  function findImageInput() {
    const inputs = Array.from(document.querySelectorAll("input[type='file']"));
    for (const input of inputs) {
      const accept = String(input.getAttribute('accept') || '').toLowerCase();
      if (accept.includes('image')) return input;
    }
    return inputs[0] || null;
  }

  async function ensureImageInput() {
    let input = findImageInput();
    if (input) return input;
    const button = getImageToolbarButton();
    if (button) {
      button.click();
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        await sleep(150);
        input = findImageInput();
        if (input) return input;
      }
    }
    throw new Error('未找到头条正文图片上传入口');
  }

  async function dataUrlToFile(dataUrl, fallbackName) {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const extension = blob.type.includes('png')
      ? 'png'
      : blob.type.includes('webp')
        ? 'webp'
        : blob.type.includes('gif')
          ? 'gif'
          : 'jpg';
    return new File([blob], `${fallbackName || `toutiao-image-${Date.now()}`}.${extension}`, {
      type: blob.type || 'image/jpeg',
    });
  }

  function findNewImageElement(editor, previousImages) {
    const images = Array.from(editor.querySelectorAll('img'));
    for (const img of images) {
      if (!previousImages.has(img)) return img;
    }
    return null;
  }

  function getDirectChild(node, editor) {
    let current = node;
    while (current && current.parentElement && current.parentElement !== editor) {
      current = current.parentElement;
    }
    return current?.parentElement === editor ? current : null;
  }

  async function uploadImageBlock(block, editor) {
    moveCursorToEditorEnd(editor);
    const input = await ensureImageInput();
    const file = await dataUrlToFile(block.data_url, block.file_name || 'toutiao-block-image');
    const previousImages = new Set(editor.querySelectorAll('img'));
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));

    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      await sleep(400);
      const newImage = findNewImageElement(editor, previousImages);
      if (newImage) {
        const wrapper = getDirectChild(newImage, editor) || newImage;
        fillImageCaption(wrapper, getImageSourceText(block));
        editor.dispatchEvent(new Event('input', { bubbles: true }));
        editor.dispatchEvent(new Event('change', { bubbles: true }));
        return { success: true, wrapper };
      }
    }

    return { success: false };
  }

  async function insertBlocks(blocks, replace, includeImages) {
    const editor = getContentEditor();
    if (!editor) throw new Error('未找到正文编辑器');
    if (replace) clearContentEditor();
    const imageResults = [];
    let hasImage = false;

    for (let index = 0; index < (blocks || []).length; index += 1) {
      const block = blocks[index];
      if (block && block.type === 'image' && block.image_url) {
        if (!includeImages) continue;
        hasImage = true;
        try {
          const result = await uploadImageBlock(block, editor);
          imageResults.push({
            source: 'block',
            blockIndex: index,
            image_url: block.image_url,
            success: !!result?.success,
          });
        } catch (error) {
          imageResults.push({
            source: 'block',
            blockIndex: index,
            image_url: block.image_url,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
        continue;
      }

      editor.appendChild(renderBlock(block || {}));
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      editor.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const oldFooter = editor.querySelector('[data-ruo-image-footer-note="true"]');
    if (oldFooter) oldFooter.remove();
    if (hasImage) {
      editor.appendChild(createBottomImageHint());
    }

    editor.dispatchEvent(new Event('input', { bubbles: true }));
    editor.dispatchEvent(new Event('change', { bubbles: true }));
    return imageResults;
  }

  async function insertPayload(payload, options) {
    if (!isToutiaoEditor()) throw new Error('当前页面不是今日头条编辑页，或编辑器尚未加载完成');
    validatePayload(payload);
    const includeTitle = options?.includeTitle !== false;
    const includeBody = options?.includeBody !== false;
    const includeImages = options?.includeImages !== false;
    const replaceBody = options?.replaceBody !== false;

    if (includeTitle) {
      const title =
        String(payload?.selected_title || '').trim() ||
        (Array.isArray(payload?.title_candidates) ? String(payload.title_candidates[0] || '') : '');
      fillTextareaValue(getTitleInput(), title);
    }

    let imageResults = [];
    if (includeBody) {
      imageResults = await insertBlocks(payload?.blocks || [], replaceBody, includeImages);
    }

    return {
      success: true,
      title:
        includeTitle
          ? String(payload?.selected_title || '').trim() ||
            (Array.isArray(payload?.title_candidates) ? String(payload.title_candidates[0] || '') : '')
          : null,
      blockCount: Array.isArray(payload?.blocks) ? payload.blocks.length : 0,
      imageResults,
    };
  }

  window.__ruoruoToutiaoPublisher__ = {
    isInstalled: true,
    version: BRIDGE_VERSION,
    isToutiaoEditor,
    insertPayload,
  };
})();
