(function () {
  if (window.__ruoruoWechatPublisher__?.isInstalled) return;

  const BLOCK_STYLES = {
    paragraph: {
      lead: {
        section: 'margin: 0 0 16px 0; visibility: visible;',
        p: 'margin: 0; visibility: visible;',
        span: 'visibility: visible; font-size: 16px; line-height: 1.85; color: #202020; font-weight: 500;',
      },
      body: {
        section: 'margin: 0 0 14px 0; visibility: visible;',
        p: 'margin: 0; visibility: visible;',
        span: 'visibility: visible; font-size: 15px; line-height: 1.8; color: #2c2c2c;',
      },
      analysis: {
        section: 'margin: 0 0 14px 0; visibility: visible;',
        p: 'margin: 0; visibility: visible;',
        span: 'visibility: visible; font-size: 15px; line-height: 1.85; color: #3a3a3a;',
      },
    },
    heading: {
      section_title: {
        section: 'margin: 22px 0 10px 0; visibility: visible;',
        p: 'margin: 0; visibility: visible;',
        strong: 'font-size: 17px; line-height: 1.6; color: #111111; font-weight: 600; visibility: visible;',
      },
      section_title_strong: {
        section: 'margin: 26px 0 12px 0; padding-left: 10px; border-left: 4px solid #111111; visibility: visible;',
        p: 'margin: 0; visibility: visible;',
        strong: 'font-size: 18px; line-height: 1.6; color: #111111; font-weight: 700; visibility: visible;',
      },
    },
    note: {
      insight_box: {
        section:
          'margin: 16px 0; padding: 12px 14px; background: #f7f8fa; border-left: 3px solid #222222; visibility: visible;',
        p: 'margin: 0; visibility: visible;',
        span: 'visibility: visible; font-size: 14px; line-height: 1.8; color: #333333;',
      },
      warning_soft: {
        section:
          'margin: 16px 0; padding: 12px 14px; background: #fff7eb; border-left: 3px solid #d48806; visibility: visible;',
        p: 'margin: 0; visibility: visible;',
        span: 'visibility: visible; font-size: 14px; line-height: 1.8; color: #5c3b00;',
      },
    },
    quote: {
      highlight_quote: {
        section:
          'margin: 18px 0; padding: 12px 14px; background: #fafafa; border-left: 3px solid #bdbdbd; visibility: visible;',
        p: 'margin: 0; visibility: visible;',
        span: 'visibility: visible; font-size: 15px; line-height: 1.85; color: #444444; font-style: italic;',
      },
      data_point: {
        section:
          'margin: 18px 0; padding: 14px 16px; background: #f5f7ff; border: 1px solid #d6defa; visibility: visible;',
        p: 'margin: 0; visibility: visible;',
        span: 'visibility: visible; font-size: 15px; line-height: 1.85; color: #223a70; font-weight: 600;',
      },
    },
    pseudo_table: {
      compare_grid: {
        outer: 'margin: 16px 0; border-top: 1px solid #d9d9d9; border-left: 1px solid #d9d9d9; visibility: visible;',
        headerBg: '#f7f7f7',
        bodyBg: '#ffffff',
      },
      fact_sheet: {
        outer: 'margin: 16px 0; border-top: 1px solid #e5e7eb; border-left: 1px solid #e5e7eb; visibility: visible;',
        headerBg: '#f3f4f6',
        bodyBg: '#fcfcfd',
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

  function createLeafSpan(text, styleText) {
    const span = document.createElement('span');
    span.setAttribute('leaf', '');
    span.setAttribute('style', styleText);
    span.textContent = text || '';
    return span;
  }

  function createParagraph(block) {
    const variant = block.variant || 'body';
    const style = getVariantStyle('paragraph', variant, 'body');
    const section = document.createElement('section');
    section.setAttribute('style', style.section);
    const p = document.createElement('p');
    p.setAttribute('style', style.p);
    let spanStyle = applyTone(applyEmphasis(style.span, block.emphasis), block.tone);
    p.appendChild(createLeafSpan(block.text, spanStyle));
    section.appendChild(p);
    return section;
  }

  function createHeading(block) {
    const variant = block.variant || 'section_title';
    const style = getVariantStyle('heading', variant, 'section_title');
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

  function createNote(block) {
    const variant = block.variant || 'insight_box';
    const style = getVariantStyle('note', variant, 'insight_box');
    const section = document.createElement('section');
    section.setAttribute('style', style.section);
    const p = document.createElement('p');
    p.setAttribute('style', style.p);
    p.appendChild(createLeafSpan(block.text, applyTone(applyEmphasis(style.span, block.emphasis), block.tone)));
    section.appendChild(p);
    return section;
  }

  function createQuote(block) {
    const variant = block.variant || 'highlight_quote';
    const style = getVariantStyle('quote', variant, 'highlight_quote');
    const section = document.createElement('section');
    section.setAttribute('style', style.section);
    const p = document.createElement('p');
    p.setAttribute('style', style.p);
    p.appendChild(createLeafSpan(block.text, applyTone(applyEmphasis(style.span, block.emphasis), block.tone)));
    section.appendChild(p);
    return section;
  }

  function createImageAttributionNote() {
    const section = document.createElement('section');
    section.setAttribute('style', 'margin: 18px 0 0 0; visibility: visible;');
    const p = document.createElement('p');
    p.setAttribute('style', 'margin: 0; visibility: visible;');
    p.appendChild(
      createLeafSpan(
        '提示：正文图片来源于网络，侵权请联系删除',
        'visibility: visible; font-size: 12px; line-height: 1.7; color: #9ca3af;',
      ),
    );
    section.appendChild(p);
    return section;
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

  function renderBlock(block) {
    switch (block.type) {
      case 'heading':
        return createHeading(block);
      case 'note':
        return createNote(block);
      case 'quote':
        return createQuote(block);
      case 'pseudo_table':
        return createPseudoTable(block);
      case 'paragraph':
      default:
        return createParagraph(block);
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
    moveCursorToContentEnd();
    const input = await ensureImageInput();
    const beforeCount = editor ? editor.querySelectorAll('img').length : 0;
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));

    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      await sleep(500);
      const currentCount = editor ? editor.querySelectorAll('img').length : 0;
      if (currentCount > beforeCount) return true;
    }
    return false;
  }

  async function uploadImageByUrl(url, fallbackName) {
    const file = await fetchImageAsFile(url, fallbackName);
    return uploadImageFile(file);
  }

  async function uploadImageByDataUrl(dataUrl, fallbackName) {
    const file = await dataUrlToFile(dataUrl, fallbackName);
    return uploadImageFile(file);
  }

  async function insertBlocks(blocks, replace = true, includeImages = true) {
    const editor = getContentEditor();
    if (!editor) throw new Error('未找到正文编辑器');
    if (replace) clearContentEditor();

    const imageResults = [];
    let hasBodyImage = false;
    for (let index = 0; index < (blocks || []).length; index += 1) {
      const block = blocks[index];
      if (isImageBlock(block)) {
        if (!includeImages) continue;
        hasBodyImage = true;
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
          imageResults.push({
            source: 'block',
            blockIndex: index,
            image_url: block.image_url,
            success: ok,
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

      editor.appendChild(renderBlock(block));
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      editor.dispatchEvent(new Event('change', { bubbles: true }));
    }

    if (hasBodyImage) {
      editor.appendChild(createImageAttributionNote());
      editor.dispatchEvent(new Event('input', { bubbles: true }));
      editor.dispatchEvent(new Event('change', { bubbles: true }));
    }

    return imageResults;
  }

  async function insertPayload(payload, options = {}) {
    if (!isWechatEditor()) throw new Error('当前页面不是公众号编辑页，或编辑器尚未加载完成');
    const includeTitle = options.includeTitle !== false;
    const includeAuthor = options.includeAuthor !== false;
    const includeSummary = options.includeSummary !== false;
    const includeBody = options.includeBody !== false;
    const includeImages = options.includeImages !== false;
    const includeSaveDraft = options.includeSaveDraft !== false;
    const replaceBody = options.replaceBody !== false;

    if (includeTitle) {
      const title = Array.isArray(payload?.title_candidates) ? payload.title_candidates[0] : '';
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
      imageResults = await insertBlocks(payload?.blocks || [], replaceBody, includeImages);
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
      title: includeTitle ? (payload?.title_candidates?.[0] || '') : null,
      authorResult,
      summaryResult,
      blockCount: Array.isArray(payload?.blocks) ? payload.blocks.length : 0,
      imageResults,
      saveDraftResult,
    };
  }

  window.__ruoruoWechatPublisher__ = {
    isInstalled: true,
    isWechatEditor,
    insertPayload,
  };
})();
