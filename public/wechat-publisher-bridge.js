(function () {
  const BRIDGE_VERSION = '2026-07-02-v2';
  if (window.__ruoruoWechatPublisher__?.version === BRIDGE_VERSION) return;

  const BLOCK_STYLES = {
    paragraph: {
      lead: {
        section: 'margin: 0 8px 24px 8px; visibility: visible;',
        p: 'margin: 0; visibility: visible;',
        span: 'visibility: visible; font-size: 15px; line-height: 1.75; color: rgba(0, 0, 0, 0.9); letter-spacing: 1px; font-family: Optima-Regular, PingFangTC-light; font-weight: 500;',
      },
      body: {
        section: 'margin: 0 8px 24px 8px; visibility: visible;',
        p: 'margin: 0; visibility: visible;',
        span: 'visibility: visible; font-size: 15px; line-height: 1.75; color: rgba(0, 0, 0, 0.9); letter-spacing: 1px; font-family: Optima-Regular, PingFangTC-light;',
      },
      analysis: {
        section: 'margin: 0 8px 24px 8px; visibility: visible;',
        p: 'margin: 0; visibility: visible;',
        span: 'visibility: visible; font-size: 15px; line-height: 1.75; color: rgba(0, 0, 0, 0.9); letter-spacing: 1px; font-family: Optima-Regular, PingFangTC-light;',
      },
    },
    heading: {
      section_title: {
        section: 'margin: 24px 8px 10px 8px; visibility: visible;',
        p: 'margin: 0; visibility: visible;',
        strong: 'font-size: 17px; line-height: 1.75; color: rgba(0, 0, 0, 0.9); font-weight: 600; letter-spacing: 1px; visibility: visible; font-family: Optima-Regular, PingFangTC-light;',
      },
      section_title_strong: {
        badgeSection:
          'margin: 22px 8px 6px 8px; text-align: left; line-height: 1.4; visibility: visible;',
        badgeSpan:
          'display: inline-block; font-size: 12px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; visibility: visible; font-family: Optima-Regular, PingFangTC-light;',
        titleSection: 'margin: 0 8px 22px 8px; text-align: left; line-height: 1.6; visibility: visible;',
        titleSpan:
          'font-size: 19px; font-weight: 700; color: rgba(0, 0, 0, 0.9); letter-spacing: 1px; visibility: visible; font-family: Optima-Regular, PingFangTC-light;',
      },
    },
    note: {
      insight_box: {
        section: 'margin: 10px 8px 22px 8px; padding-left: 10px; border-left: 1.5px solid #d7dde6; visibility: visible;',
        p: 'margin: 0; visibility: visible;',
        span: 'visibility: visible; font-size: 13px; line-height: 1.85; color: #666666; letter-spacing: 0.6px; font-family: Optima-Regular, PingFangTC-light;',
      },
      warning_soft: {
        section: 'margin: 10px 8px 22px 8px; padding-left: 10px; border-left: 1.5px solid #d7dde6; visibility: visible;',
        p: 'margin: 0; visibility: visible;',
        span: 'visibility: visible; font-size: 13px; line-height: 1.85; color: #666666; letter-spacing: 0.6px; font-family: Optima-Regular, PingFangTC-light;',
      },
    },
    quote: {
      data_point: {
        section: 'margin: 18px 8px; padding: 10px 0; border-top: 1px solid #ececec; border-bottom: 1px solid #ececec; visibility: visible;',
        p: 'margin: 0; visibility: visible;',
        span: 'visibility: visible; font-size: 15px; line-height: 1.75; color: rgba(0, 0, 0, 0.9); font-weight: 600; letter-spacing: 1px; font-family: Optima-Regular, PingFangTC-light;',
      },
    },
    pseudo_table: {
      compare_grid: {
        outer: 'margin: 16px 0; border-top: 1px solid #e3e3e3; border-left: 1px solid #e3e3e3; visibility: visible;',
        headerBg: '#f8f8f8',
        bodyBg: '#ffffff',
      },
      fact_sheet: {
        outer: 'margin: 16px 0; border-top: 1px solid #e6e6e6; border-left: 1px solid #e6e6e6; visibility: visible;',
        headerBg: '#f7f7f7',
        bodyBg: '#ffffff',
      },
    },
  };

  function getVariantStyle(type, variant, fallback) {
    const bucket = BLOCK_STYLES[type] || {};
    return bucket[variant] || bucket[fallback];
  }

  function applyEmphasis(styleText, emphasis) {
    if (emphasis === 'high') return `${styleText} font-weight: 600;`;
    if (emphasis === 'low') return `${styleText} opacity: 0.9;`;
    return styleText;
  }

  function applyTone(styleText, tone) {
    if (tone === 'strong') return `${styleText} color: #111111;`;
    if (tone === 'warm') return `${styleText} color: #5a4331;`;
    return styleText;
  }

  function normalizeHexColor(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    const fullHex = text.match(/^#([0-9a-fA-F]{6})$/);
    if (fullHex) return `#${fullHex[1].toLowerCase()}`;
    const shortHex = text.match(/^#([0-9a-fA-F]{3})$/);
    if (shortHex) {
      const [r, g, b] = shortHex[1].split('');
      return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
    }
    return '';
  }

  function hexToRgb(hex) {
    const normalized = normalizeHexColor(hex);
    if (!normalized) return null;
    return {
      r: parseInt(normalized.slice(1, 3), 16),
      g: parseInt(normalized.slice(3, 5), 16),
      b: parseInt(normalized.slice(5, 7), 16),
    };
  }

  function mixHexWithWhite(hex, ratio = 0.5) {
    const rgb = hexToRgb(hex);
    if (!rgb) return '';
    const safeRatio = Math.max(0, Math.min(1, ratio));
    const mix = (value) => Math.round(value * (1 - safeRatio) + 255 * safeRatio);
    return `rgb(${mix(rgb.r)}, ${mix(rgb.g)}, ${mix(rgb.b)})`;
  }

  function getThemeConfig(payload) {
    const accentColor = normalizeHexColor(payload?.theme?.accent_color) || '#6c7b95';
    return {
      accentColor,
      accentLight: mixHexWithWhite(accentColor, 0.48) || '#d7dde6',
    };
  }

  function validatePayload(payload) {
    if (!payload || typeof payload !== 'object') throw new Error('payload 格式无效');
    if (!Array.isArray(payload.title_candidates) || payload.title_candidates.length !== 3) {
      throw new Error('新版协议要求 title_candidates 必须提供 3 个标题');
    }
    if (!String(payload.summary || '').trim()) {
      throw new Error('新版协议要求必须提供 summary');
    }
    if (!payload.theme || !normalizeHexColor(payload.theme.accent_color)) {
      throw new Error('新版协议要求必须提供 theme.accent_color');
    }
    if (!Array.isArray(payload.blocks)) {
      throw new Error('新版协议要求 blocks 必须是数组');
    }
  }

  function getTitleEditor() {
    return (
      document.querySelector('#js_title_main .title-editor-overlay .ProseMirror') ||
      document.querySelector('.title-editor-overlay .ProseMirror')
    );
  }

  function getContentEditor() {
    return (
      document.querySelector('#js_ueditor .mock-iframe-body .ProseMirror') ||
      document.querySelector('#js_ueditor .mock-iframe-body .rich_media_content .ProseMirror')
    );
  }

  function getImageInput() {
    return document.querySelector("#js_editor_insertimage input[type='file']");
  }

  function isNodeVisible(node) {
    if (!node) return false;
    const style = window.getComputedStyle(node);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function isWechatEditor() {
    return !!(getTitleEditor() && getContentEditor());
  }

  function getMpNickName() {
    const candidates = [
      window.wx?.data?.nick_name,
    ];
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    }

    const domCandidates = [
      '.weui-desktop-account__info',
      '.account_info',
      '.account_meta',
      '.publish__account',
      '.weui-desktop-layout__hd',
      '[class*="account"]',
      '[class*="nick"]',
    ];
    for (const selector of domCandidates) {
      const nodes = Array.from(document.querySelectorAll(selector));
      for (const node of nodes) {
        if (!isNodeVisible(node)) continue;
        const text = String(node.textContent || '').trim().replace(/\s+/g, ' ');
        if (text && text.length >= 2 && text.length <= 32 && !text.includes('草稿') && !text.includes('保存')) {
          return text;
        }
      }
    }
    return '';
  }

  function findFirst(selectors) {
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      if (node) return node;
    }
    return null;
  }

  function findFirstVisible(selectors) {
    for (const selector of selectors) {
      const nodes = Array.from(document.querySelectorAll(selector));
      for (const node of nodes) {
        if (isNodeVisible(node)) return node;
      }
    }
    return null;
  }

  function findAuthorInput() {
    const directMatch = findFirstVisible([
      '#author',
      "input.js_author[name='author']",
      "input[name='author']",
      "input[placeholder='请输入作者']",
      "input[placeholder*='作者']",
      "input[id*='author']",
      "input[class*='author']",
    ]);
    if (directMatch) return directMatch;

    const inputs = Array.from(document.querySelectorAll('input')).filter((node) => isNodeVisible(node));
    for (const input of inputs) {
      const attrs = [
        input.getAttribute('name') || '',
        input.getAttribute('id') || '',
        input.getAttribute('class') || '',
        input.getAttribute('placeholder') || '',
      ].join(' ');
      if (attrs.includes('author') || attrs.includes('作者')) return input;

      const field = input.closest('.weui-desktop-form__control-group, .frm_control_group, .setting-group, .form-group');
      const fieldText = String(field?.textContent || '');
      if (fieldText.includes('作者')) return input;
    }
    return null;
  }

  function setProseMirrorText(node, text) {
    if (!node) throw new Error('未找到编辑器节点');
    node.focus();
    node.innerHTML = '';
    const p = document.createElement('p');
    const span = document.createElement('span');
    span.setAttribute('leaf', '');
    span.textContent = text || '';
    p.appendChild(span);
    node.appendChild(p);
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function fillInputValue(node, value) {
    if (!node) throw new Error('未找到输入框');
    node.click();
    node.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (setter) {
      setter.call(node, value || '');
    } else {
      node.value = value || '';
    }
    node.setAttribute('value', value || '');
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
    node.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter' }));
    node.blur();
  }

  function fillTextareaValue(node, value) {
    if (!node) throw new Error('未找到文本框');
    node.click();
    node.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
    if (setter) {
      setter.call(node, value || '');
    } else {
      node.value = value || '';
    }
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
    node.blur();
  }

  function fillAuthor(payload) {
    const authorName = getMpNickName() || payload?.author_name || payload?.author || '';
    if (!authorName) return { filled: false, author: '', reason: '未拿到作者名' };

    const authorInput = findAuthorInput();
    if (!authorInput) return { filled: false, author: authorName, reason: '未找到作者输入框' };

    fillInputValue(authorInput, authorName);
    const currentValue = String(authorInput.value || authorInput.getAttribute('value') || '').trim();
    return {
      filled: currentValue === authorName,
      author: authorName,
      reason: currentValue === authorName ? '' : `回填后值为: ${currentValue || '(空)'}`,
    };
  }

  function fillSummary(payload) {
    const summaryText = String(payload?.summary || payload?.digest || '').trim();
    if (!summaryText) return { filled: false, summary: '' };

    const summaryInput = findFirstVisible([
      '#js_description',
      "#js_description_area textarea[name='digest']",
      "textarea[name='digest']",
      "textarea[placeholder*='摘要']",
    ]);
    if (!summaryInput) return { filled: false, summary: summaryText };

    if (summaryInput.tagName === 'TEXTAREA') {
      fillTextareaValue(summaryInput, summaryText);
    } else {
      fillInputValue(summaryInput, summaryText);
    }
    return { filled: true, summary: summaryText };
  }

  function clearContentEditor() {
    const editor = getContentEditor();
    if (!editor) throw new Error('未找到正文编辑器');
    const dirtyNodes = Array.from(
      editor.querySelectorAll('[data-ruo-upload-anchor="true"], [data-ruo-image-attribution="true"]'),
    );
    dirtyNodes.forEach((node) => node.remove());
    editor.replaceChildren();
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    editor.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function moveCursorToContentEnd() {
    const editor = getContentEditor();
    if (!editor) throw new Error('未找到正文编辑器');
    editor.focus();
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function getEditorDirectChild(node, editor) {
    if (!node || !editor) return null;
    let current = node;
    while (current && current.parentElement && current.parentElement !== editor) {
      current = current.parentElement;
    }
    return current?.parentElement === editor ? current : null;
  }

  function collectTrailingImageNodes(imageBlock, editor) {
    const nodes = [];
    let current = imageBlock?.nextSibling || null;
    while (current) {
      if (current.nodeType !== Node.ELEMENT_NODE) break;
      const element = current;
      const tagName = (element.tagName || '').toLowerCase();
      const text = String(element.textContent || '').replace(/\s+/g, '');
      const hasImage = !!element.querySelector?.('img.rich_pages.wxw-img.js_insertlocalimg');
      const isAttribution = element.getAttribute?.('data-ruo-image-attribution') === 'true';
      const isAnchor = element.getAttribute?.('data-ruo-upload-anchor') === 'true';

      if (hasImage || isAttribution || isAnchor) break;

      const isEmptyParagraphLike =
        (tagName === 'p' || tagName === 'section') &&
        !text &&
        !!element.querySelector?.('br.ProseMirror-trailingBreak, span[leaf]');

      if (!isEmptyParagraphLike) break;
      if (element.parentElement !== editor) break;
      nodes.push(element);
      current = element.nextSibling;
    }
    return nodes;
  }

  function createUploadAnchor() {
    const anchor = document.createElement('p');
    anchor.setAttribute('data-ruo-upload-anchor', 'true');
    anchor.setAttribute('style', 'margin:0; visibility:visible;');
    const span = document.createElement('span');
    span.setAttribute('leaf', '');
    span.textContent = '';
    anchor.appendChild(span);
    return anchor;
  }

  function removeUploadAnchors() {
    const editor = getContentEditor();
    if (!editor) return;
    const anchors = Array.from(editor.querySelectorAll('[data-ruo-upload-anchor="true"]'));
    anchors.forEach((anchor) => anchor.remove());
  }

  function removeImageAttributions() {
    const editor = getContentEditor();
    if (!editor) return;
    const attributions = Array.from(editor.querySelectorAll('[data-ruo-image-attribution="true"]'));
    attributions.forEach((node) => node.remove());
  }

  function moveSelectionToNodeEnd(node) {
    if (!node) return;
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function prepareImageInsertionAnchor() {
    const editor = getContentEditor();
    if (!editor) throw new Error('未找到正文编辑器');
    removeUploadAnchors();
    const anchor = createUploadAnchor();
    editor.appendChild(anchor);
    moveSelectionToNodeEnd(anchor);
    return anchor;
  }

  function findNewImageElement(editor, previousImages) {
    const images = Array.from(editor.querySelectorAll('img.rich_pages.wxw-img.js_insertlocalimg'));
    for (const img of images) {
      if (!previousImages.has(img)) return img;
    }
    return null;
  }

  function getImageBlockContainer(imageElement, editor) {
    if (!imageElement || !editor) return null;

    let current = imageElement.parentElement;
    while (current && current !== editor) {
      const containsTargetImage = current.querySelector('img.rich_pages.wxw-img.js_insertlocalimg') === imageElement;
      const text = String(current.textContent || '').replace(/\s+/g, '');
      if (containsTargetImage && !text && current.tagName === 'SECTION') {
        return current;
      }
      current = current.parentElement;
    }

    return getEditorDirectChild(imageElement, editor);
  }

  function relocateImageBlock(editor, imageElement, anchor) {
    if (!editor || !imageElement || !anchor) return null;
    const imageBlock = getImageBlockContainer(imageElement, editor);
    if (!imageBlock) return null;
    const trailingNodes = collectTrailingImageNodes(imageBlock, editor);

    if (imageBlock.previousSibling !== anchor) {
      editor.insertBefore(imageBlock, anchor.nextSibling);
    }
    let insertAfter = imageBlock;
    for (const node of trailingNodes) {
      editor.insertBefore(node, insertAfter.nextSibling);
      insertAfter = node;
    }
    return imageBlock;
  }

  function insertAttributionAfterImageBlock(editor, imageBlock, block) {
    if (!editor || !imageBlock) return;
    const nextNode = imageBlock.nextSibling;
    if (
      nextNode &&
      nextNode.nodeType === Node.ELEMENT_NODE &&
      nextNode.getAttribute('data-ruo-image-attribution') === 'true'
    ) {
      nextNode.remove();
    }

    const attribution = createImageAttributionNote(block);
    attribution.setAttribute('data-ruo-image-attribution', 'true');
    editor.insertBefore(attribution, imageBlock.nextSibling);
  }

  function createLeafSpan(text, styleText) {
    const span = document.createElement('span');
    span.setAttribute('leaf', '');
    span.setAttribute('style', styleText);
    span.textContent = text || '';
    return span;
  }

  function normalizeSegmentMarks(segment) {
    const marks = Array.isArray(segment?.marks) ? segment.marks : [];
    return marks
      .map((mark) => String(mark || '').trim())
      .filter(Boolean);
  }

  function getSegmentStyle(baseStyle, marks, renderContext) {
    let style = baseStyle;
    if (marks.includes('bold')) style += ' font-weight: 700;';
    if (marks.includes('underline')) {
      style += ' text-decoration: underline; text-decoration-thickness: 1px; text-underline-offset: 2px;';
    }
    if (marks.includes('accent')) {
      style += ` color: ${renderContext.theme.accentColor};`;
    }
    return style;
  }

  function createParagraph(block, renderContext) {
    const variant = block.variant || 'body';
    const style = getVariantStyle('paragraph', variant, 'body');
    const section = document.createElement('section');
    section.setAttribute('style', style.section);
    const p = document.createElement('p');
    p.setAttribute('style', style.p);
    let spanStyle = applyTone(applyEmphasis(style.span, block.emphasis), block.tone);
    const segments = Array.isArray(block.segments) ? block.segments : [];
    if (segments.length) {
      segments.forEach((segment) => {
        const text = String(segment?.text || '');
        if (!text) return;
        const marks = normalizeSegmentMarks(segment);
        p.appendChild(createLeafSpan(text, getSegmentStyle(spanStyle, marks, renderContext)));
      });
    } else {
      p.appendChild(createLeafSpan(block.text, spanStyle));
    }
    section.appendChild(p);
    return section;
  }

  function createHeading(block, renderContext) {
    const variant = block.variant || 'section_title';
    const style = getVariantStyle('heading', variant, 'section_title');
    if (variant === 'section_title_strong') {
      renderContext.strongHeadingIndex += 1;
      const fragment = document.createDocumentFragment();

      const badgeSection = document.createElement('section');
      badgeSection.setAttribute('style', style.badgeSection);
      const badgeP = document.createElement('p');
      badgeP.setAttribute('style', 'margin: 0; visibility: visible;');
      const badgeSpan = document.createElement('span');
      badgeSpan.setAttribute(
        'style',
        `${style.badgeSpan} color: ${renderContext.theme.accentColor};`,
      );
      badgeSpan.textContent = block.badge || `Part ${String(renderContext.strongHeadingIndex).padStart(2, '0')}`;
      badgeP.appendChild(badgeSpan);
      badgeSection.appendChild(badgeP);

      const titleSection = document.createElement('section');
      titleSection.setAttribute('style', style.titleSection);
      const titleP = document.createElement('p');
      titleP.setAttribute('style', 'margin: 0; visibility: visible;');
      const titleSpan = document.createElement('span');
      titleSpan.setAttribute('style', applyTone(applyEmphasis(style.titleSpan, block.emphasis), block.tone));
      titleSpan.textContent = block.text || '';
      titleP.appendChild(titleSpan);
      titleSection.appendChild(titleP);

      fragment.appendChild(badgeSection);
      fragment.appendChild(titleSection);
      return fragment;
    }

    const section = document.createElement('section');
    section.setAttribute('style', style.section);
    const p = document.createElement('p');
    p.setAttribute('style', style.p);
    const strong = document.createElement('strong');
    strong.setAttribute('style', applyTone(applyEmphasis(style.strong, block.emphasis), block.tone));
    strong.textContent = block.text || '';
    p.appendChild(strong);
    section.appendChild(p);
    return section;
  }

  function createNote(block, renderContext) {
    const variant = block.variant || 'insight_box';
    const style = getVariantStyle('note', variant, 'insight_box');
    const section = document.createElement('section');
    const borderColor = variant === 'warning_soft' ? renderContext.theme.accentLight : '#d7dde6';
    section.setAttribute('style', `${style.section} border-left-color: ${borderColor};`);
    const p = document.createElement('p');
    p.setAttribute('style', style.p);
    const prefix = document.createElement('span');
    prefix.setAttribute(
      'style',
      `visibility: visible; color: ${renderContext.theme.accentColor}; font-weight: 600;`,
    );
    prefix.textContent = variant === 'warning_soft' ? '提醒：' : '补充：';
    p.appendChild(prefix);
    p.appendChild(
      createLeafSpan(` ${block.text || ''}`, applyTone(applyEmphasis(style.span, block.emphasis), block.tone)),
    );
    section.appendChild(p);
    return section;
  }

  function createQuote(block) {
    const style = getVariantStyle('quote', 'data_point', 'data_point');
    const section = document.createElement('section');
    section.setAttribute('style', style.section);
    const p = document.createElement('p');
    p.setAttribute('style', style.p);
    p.appendChild(createLeafSpan(block.text, applyTone(applyEmphasis(style.span, block.emphasis), block.tone)));
    section.appendChild(p);
    return section;
  }

  function createListItem(prefixText, itemText, itemIndex) {
    const section = document.createElement('section');
    section.setAttribute(
      'style',
      itemIndex === 0
        ? 'margin: 0 0 10px 0; visibility: visible;'
        : 'margin: 10px 0 0 0; visibility: visible;',
    );
    const row = document.createElement('section');
    row.setAttribute('style', 'font-size:0; visibility:visible;');

    const prefix = document.createElement('section');
    prefix.setAttribute(
      'style',
      'display:inline-block; width:18px; vertical-align:top; visibility:visible;',
    );
    const prefixP = document.createElement('p');
    prefixP.setAttribute('style', 'margin:0; visibility:visible;');
    prefixP.appendChild(
      createLeafSpan(
        prefixText,
        'visibility: visible; color:#7a7a7a; font-size:14px; line-height:1.8; font-weight:700;',
      ),
    );
    prefix.appendChild(prefixP);

    const content = document.createElement('section');
    content.setAttribute(
      'style',
      'display:inline-block; width:calc(100% - 18px); vertical-align:top; visibility:visible;',
    );
    const contentP = document.createElement('p');
    contentP.setAttribute('style', 'margin:0; visibility:visible;');
    contentP.appendChild(
      createLeafSpan(
        itemText,
        'visibility: visible; color:rgba(0, 0, 0, 0.9); font-size:15px; line-height:1.75; letter-spacing:1px; font-family: Optima-Regular, PingFangTC-light;',
      ),
    );
    content.appendChild(contentP);

    row.appendChild(prefix);
    row.appendChild(content);
    section.appendChild(row);
    return section;
  }

  function createBulletList(block) {
    const outer = document.createElement('section');
    outer.setAttribute('style', 'margin: 16px 0; visibility: visible;');
    const items = Array.isArray(block.items) ? block.items : [];
    items.forEach((itemText, itemIndex) => {
      outer.appendChild(createListItem('•', String(itemText ?? ''), itemIndex));
    });
    return outer;
  }

  function createNumberedList(block) {
    const outer = document.createElement('section');
    outer.setAttribute('style', 'margin: 16px 0; visibility: visible;');
    const items = Array.isArray(block.items) ? block.items : [];
    items.forEach((itemText, itemIndex) => {
      outer.appendChild(createListItem(String(itemIndex + 1), String(itemText ?? ''), itemIndex));
    });
    return outer;
  }

  function getImageSourceText(block) {
    const sourceName = String(block?.source_name || '').trim();
    if (sourceName) return sourceName;

    const sourcePage = String(block?.source_page || '').trim();
    if (!sourcePage) return '网络';

    try {
      const hostname = new URL(sourcePage).hostname.replace(/^www\./i, '');
      return hostname || sourcePage;
    } catch (_error) {
      return sourcePage;
    }
  }

  function createImageAttributionNote(block) {
    const sourceText = getImageSourceText(block);
    const section = document.createElement('section');
    section.setAttribute('style', 'margin: 4px 0 14px 0; visibility: visible;');
    const p = document.createElement('p');
    p.setAttribute(
      'style',
      'margin: 0; text-align: center; visibility: visible; font-size: 12px; line-height: 1.7; color: #9ca3af;',
    );
    p.textContent = `（图片来源：${sourceText}）`;
    section.appendChild(p);
    return section;
  }

  function normalizeImageAttributionNodes() {
    const editor = getContentEditor();
    if (!editor) return;
    const nodes = Array.from(editor.querySelectorAll('[data-ruo-image-attribution="true"]'));
    nodes.forEach((node) => {
      const text = String(node.textContent || '').trim();
      if (!text.includes('图片来源：')) return;
      const section = document.createElement('section');
      section.setAttribute('style', 'margin: 4px 0 14px 0; visibility: visible;');
      section.setAttribute('data-ruo-image-attribution', 'true');
      const p = document.createElement('p');
      p.setAttribute(
        'style',
        'margin: 0; text-align: center; visibility: visible; font-size: 12px; line-height: 1.7; color: #9ca3af;',
      );
      p.textContent = text;
      section.appendChild(p);
      node.replaceWith(section);
    });
  }

  function createPseudoTable(block) {
    const variant = block.variant || 'compare_grid';
    const style = getVariantStyle('pseudo_table', variant, 'compare_grid');
    const outer = document.createElement('section');
    outer.setAttribute(
      'style',
      `${style.outer}; display:table; width:100%; table-layout:fixed; border-collapse:collapse;`,
    );
    const rows = [];
    if (Array.isArray(block.columns) && block.columns.length) rows.push(block.columns);
    if (Array.isArray(block.rows)) rows.push(...block.rows);
    const totalCols = Math.max(...rows.map((row) => row.length), 1);

    rows.forEach((row, rowIndex) => {
      const rowSection = document.createElement('section');
      rowSection.setAttribute('style', 'display:table-row; visibility:visible;');

      for (let colIndex = 0; colIndex < totalCols; colIndex += 1) {
        const cellText = row[colIndex];
        const cell = document.createElement('section');
        cell.setAttribute(
          'style',
          [
            'display:table-cell',
            'vertical-align:top',
            'box-sizing:border-box',
            'padding:10px 8px',
            'border-right:1px solid #d9d9d9',
            'border-bottom:1px solid #d9d9d9',
            `background:${rowIndex === 0 ? style.headerBg : style.bodyBg}`,
            'visibility:visible',
            'word-break:break-word',
          ].join(';'),
        );

        const p = document.createElement('p');
        p.setAttribute('style', 'margin:0; visibility:visible;');
        p.appendChild(
          createLeafSpan(
            String(cellText ?? ''),
            rowIndex === 0
              ? 'visibility: visible; color:#333333; font-size:14px; line-height:1.7; font-weight:600;'
              : 'visibility: visible; color:#333333; font-size:14px; line-height:1.7;',
          ),
        );
        cell.appendChild(p);
        rowSection.appendChild(cell);
      }

      outer.appendChild(rowSection);
    });
    return outer;
  }

  function isImageBlock(block) {
    return block && block.type === 'image' && !!block.image_url;
  }

  function renderBlock(block, renderContext) {
    switch (block.type) {
      case 'heading':
        return createHeading(block, renderContext);
      case 'note':
        return createNote(block, renderContext);
      case 'quote':
        return createQuote(block);
      case 'bullet_list':
        return createBulletList(block);
      case 'numbered_list':
        return createNumberedList(block);
      case 'pseudo_table':
        return createPseudoTable(block);
      case 'paragraph':
      default:
        return createParagraph(block, renderContext);
    }
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function fetchImageAsFile(url, fallbackName) {
    const response = await fetch(url, { credentials: 'omit' });
    if (!response.ok) throw new Error(`图片下载失败: ${response.status}`);
    const blob = await response.blob();
    const extension = blob.type.includes('png')
      ? 'png'
      : blob.type.includes('webp')
        ? 'webp'
        : blob.type.includes('gif')
          ? 'gif'
          : 'jpg';
    const fileName = fallbackName || `wechat-image-${Date.now()}.${extension}`;
    return new File([blob], fileName, { type: blob.type || 'image/jpeg' });
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
    const fileName = fallbackName || `wechat-image-${Date.now()}.${extension}`;
    return new File([blob], fileName, { type: blob.type || 'image/jpeg' });
  }

  async function ensureImageInput() {
    let input = getImageInput();
    if (input) return input;
    const imageMenu = document.querySelector('#js_editor_insertimage');
    if (imageMenu) {
      imageMenu.click();
      await sleep(300);
      input = getImageInput();
    }
    if (!input) throw new Error('未找到正文图片上传入口');
    return input;
  }

  async function waitForDraftSaved(timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const successNodes = Array.from(document.querySelectorAll('body *')).filter((node) => {
        const text = String(node.textContent || '').trim();
        if (!text) return false;
        return (
          text.includes('保存成功') ||
          text.includes('草稿已保存') ||
          text.includes('保存草稿成功') ||
          text.includes('自动保存')
        );
      });
      if (successNodes.length) {
        return { success: true, signalText: String(successNodes[0].textContent || '').trim() };
      }
      await sleep(500);
    }
    return { success: false, signalText: '' };
  }

  async function saveDraft() {
    const buttonCandidates = [
      Array.from(document.querySelectorAll('button')).find((node) => String(node.textContent || '').includes('保存为草稿')),
      Array.from(document.querySelectorAll('*')).find((node) => String(node.textContent || '').includes('保存为草稿')),
      document.querySelector('#js_submit'),
      Array.from(document.querySelectorAll('*')).find((node) => String(node.textContent || '').trim() === '保存'),
    ].filter(Boolean);

    for (const button of buttonCandidates) {
      try {
        if (!isNodeVisible(button)) continue;
        await sleep(2500);
        button.click();
        return await waitForDraftSaved(15000);
      } catch (_error) {
        // continue
      }
    }
    throw new Error('未找到保存草稿按钮');
  }

  async function uploadImageFile(file) {
    const editor = getContentEditor();
    if (!editor) throw new Error('未找到正文编辑器');
    const anchor = prepareImageInsertionAnchor();
    const input = await ensureImageInput();
    const previousImages = new Set(editor.querySelectorAll('img'));
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));

    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      await sleep(500);
      const newImage = findNewImageElement(editor, previousImages);
      if (newImage) {
        const imageBlock = relocateImageBlock(editor, newImage, anchor);
        return { success: true, imageBlock, anchor };
      }
    }
    anchor.remove();
    return { success: false, imageBlock: null, anchor: null };
  }

  async function uploadImageByUrl(url, fallbackName) {
    const file = await fetchImageAsFile(url, fallbackName);
    return uploadImageFile(file);
  }

  async function uploadImageByDataUrl(dataUrl, fallbackName) {
    const file = await dataUrlToFile(dataUrl, fallbackName);
    return uploadImageFile(file);
  }

  async function insertBlocks(blocks, replace = true, includeImages = true, themeConfig = null) {
    const editor = getContentEditor();
    if (!editor) throw new Error('未找到正文编辑器');
    if (replace) clearContentEditor();
    else {
      removeUploadAnchors();
    }

    const renderContext = {
      theme: themeConfig || getThemeConfig({}),
      strongHeadingIndex: 0,
    };
    const imageResults = [];
    for (let index = 0; index < (blocks || []).length; index += 1) {
      const block = blocks[index];
      if (isImageBlock(block)) {
        if (!includeImages) continue;
        try {
          const ok = block.data_url
            ? await uploadImageByDataUrl(
                block.data_url,
                block.file_name || `block-image-${index + 1}`,
              )
            : await uploadImageByUrl(
                block.image_url,
                block.file_name || `block-image-${index + 1}`,
              );
          if (ok?.success) {
            insertAttributionAfterImageBlock(editor, ok.imageBlock, block);
            if (ok.anchor) ok.anchor.remove();
            editor.dispatchEvent(new Event('input', { bubbles: true }));
            editor.dispatchEvent(new Event('change', { bubbles: true }));
          } else if (ok?.anchor) {
            ok.anchor.remove();
          }
          imageResults.push({
            source: 'block',
            blockIndex: index,
            image_url: block.image_url,
            success: !!ok?.success,
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

      editor.appendChild(renderBlock(block, renderContext));
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      editor.dispatchEvent(new Event('change', { bubbles: true }));
    }

    removeUploadAnchors();
    normalizeImageAttributionNodes();
    editor.dispatchEvent(new Event('input', { bubbles: true }));
    editor.dispatchEvent(new Event('change', { bubbles: true }));

    return imageResults;
  }

  async function insertPayload(payload, options = {}) {
    if (!isWechatEditor()) throw new Error('当前页面不是公众号编辑页，或编辑器尚未加载完成');
    validatePayload(payload);
    const includeTitle = options.includeTitle !== false;
    const includeAuthor = options.includeAuthor !== false;
    const includeSummary = options.includeSummary !== false;
    const includeBody = options.includeBody !== false;
    const includeImages = options.includeImages !== false;
    const includeSaveDraft = options.includeSaveDraft !== false;
    const replaceBody = options.replaceBody !== false;

    if (includeTitle) {
      const title =
        String(payload?.selected_title || '').trim() ||
        (Array.isArray(payload?.title_candidates) ? String(payload.title_candidates[0] || '') : '');
      setProseMirrorText(getTitleEditor(), title || '');
    }

    let authorResult = { filled: false, author: '' };
    if (includeAuthor) {
      authorResult = fillAuthor(payload);
    }

    let summaryResult = { filled: false, summary: '' };
    if (includeSummary) {
      summaryResult = fillSummary(payload);
    }

    let imageResults = [];
    if (includeBody) {
      imageResults = await insertBlocks(
        payload?.blocks || [],
        replaceBody,
        includeImages,
        getThemeConfig(payload),
      );
    } else if (includeImages) {
      throw new Error('新版协议要求正文图片必须作为 image block 存在于 blocks 中');
    }

    let saveDraftResult = null;
    if (includeSaveDraft) {
      try {
        saveDraftResult = await saveDraft();
      } catch (error) {
        saveDraftResult = {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }

    return {
      success: true,
      title:
        includeTitle
          ? String(payload?.selected_title || '').trim() ||
            (Array.isArray(payload?.title_candidates) ? String(payload.title_candidates[0] || '') : '')
          : null,
      authorResult,
      summaryResult,
      blockCount: Array.isArray(payload?.blocks) ? payload.blocks.length : 0,
      imageResults,
      saveDraftResult,
    };
  }

  window.__ruoruoWechatPublisher__ = {
    isInstalled: true,
    version: BRIDGE_VERSION,
    isWechatEditor,
    insertPayload,
  };
})();
