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

  function getCoverArea() {
    return document.querySelector('#js_cover_area');
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
    const wxData = window.wx?.data;
    if (!wxData || typeof wxData.nick_name !== 'string') return '';
    return wxData.nick_name.trim();
  }

  function findFirst(selectors) {
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      if (node) return node;
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
    node.focus();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    if (setter) {
      setter.call(node, value || '');
    } else {
      node.value = value || '';
    }
    node.dispatchEvent(new Event('input', { bubbles: true }));
    node.dispatchEvent(new Event('change', { bubbles: true }));
    node.blur();
  }

  function fillTextareaValue(node, value) {
    if (!node) throw new Error('未找到文本框');
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
    if (!authorName) return { filled: false, author: '' };

    const authorInput = findFirst([
      '#author',
      "input.js_author[name='author']",
      "input[placeholder='请输入作者']",
    ]);
    if (!authorInput) return { filled: false, author: authorName };

    fillInputValue(authorInput, authorName);
    return { filled: true, author: authorName };
  }

  function fillSummary(payload) {
    const summaryText = String(payload?.summary || payload?.digest || '').trim();
    if (!summaryText) return { filled: false, summary: '' };

    const summaryInput = findFirst([
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

  function createPseudoTable(block) {
    const variant = block.variant || 'compare_grid';
    const style = getVariantStyle('pseudo_table', variant, 'compare_grid');
    const outer = document.createElement('section');
    outer.setAttribute('style', style.outer);
    const rows = [];
    if (Array.isArray(block.columns) && block.columns.length) rows.push(block.columns);
    if (Array.isArray(block.rows)) rows.push(...block.rows);
    const totalCols = Math.max(...rows.map((row) => row.length), 1);
    const colWidth = `${(100 / totalCols).toFixed(4)}%`;

    rows.forEach((row, rowIndex) => {
      const rowSection = document.createElement('section');
      rowSection.setAttribute('style', 'font-size:0; visibility:visible;');

      row.forEach((cellText) => {
        const cell = document.createElement('section');
        cell.setAttribute(
          'style',
          [
            'display:inline-block',
            'vertical-align:top',
            `width:${colWidth}`,
            'box-sizing:border-box',
            'padding:10px 8px',
            'border-right:1px solid #d9d9d9',
            'border-bottom:1px solid #d9d9d9',
            `background:${rowIndex === 0 ? style.headerBg : style.bodyBg}`,
            'visibility:visible',
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
      });

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

  async function ensureCoverImageInput() {
    const coverArea = getCoverArea();
    if (!coverArea) throw new Error('未找到封面区域');

    let input = coverArea.querySelector("input[type='file']");
    if (input) return input;

    const triggers = [
      coverArea.querySelector('.js_cover_btn_area.select-cover__mask'),
      coverArea.querySelector('.js_chooseCover'),
      coverArea.querySelector('.js_modifyCover'),
    ].filter(Boolean);

    for (const trigger of triggers) {
      try {
        trigger.click();
        await sleep(300);
        input = coverArea.querySelector("input[type='file']");
        if (input) return input;
      } catch (_error) {
        // continue
      }
    }

    if (!input) {
      input = coverArea.querySelector("input[type='file']");
    }
    if (!input) throw new Error('未找到封面上传入口');
    return input;
  }

  async function getVisibleCoverEntryBySelector(coverArea, selector, text) {
    const nodes = Array.from(coverArea.querySelectorAll(selector));
    for (const node of nodes) {
      if (text && !String(node.textContent || '').includes(text)) continue;
      if (isNodeVisible(node)) return node;
    }
    return null;
  }

  async function ensureCoverMenuOpened() {
    const coverArea = getCoverArea();
    if (!coverArea) throw new Error('未找到封面区域 #js_cover_area');

    const triggers = [
      coverArea.querySelector('.js_cover_btn_area.select-cover__mask'),
      coverArea.querySelector('.js_chooseCover'),
      coverArea.querySelector('.js_modifyCover'),
    ].filter(Boolean);

    for (const trigger of triggers) {
      try {
        if (!isNodeVisible(trigger)) continue;
        trigger.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        await sleep(300);
        trigger.click();
        await sleep(500);
      } catch (_error) {
        // continue
      }

      const visibleEntry = await getVisibleCoverEntryBySelector(
        coverArea,
        '.js_selectCoverFromContent',
        '从正文选择',
      );
      if (visibleEntry) return coverArea;
    }

    coverArea.querySelectorAll('.js_cover_opr, #js_cover_null, .js_cover_null_pop').forEach((node) => {
      node.style.display = 'block';
      node.style.visibility = 'visible';
      node.style.opacity = '1';
    });
    coverArea.querySelectorAll('.js_chooseCoverWrap').forEach((node) => {
      node.style.display = 'flex';
      node.style.visibility = 'visible';
      node.style.opacity = '1';
    });
    await sleep(300);

    const visibleEntry = await getVisibleCoverEntryBySelector(
      coverArea,
      '.js_selectCoverFromContent',
      '从正文选择',
    );
    if (!visibleEntry) throw new Error('未找到可见的“从正文选择”封面入口');
    return coverArea;
  }

  async function waitForDialogByTitle(titleText, timeoutMs = 10000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const dialogs = Array.from(document.querySelectorAll('.weui-desktop-dialog'));
      for (const dialog of dialogs) {
        const titleNode = dialog.querySelector('.weui-desktop-dialog__title');
        const title = String(titleNode?.textContent || '').trim();
        if (title.includes(titleText) && isNodeVisible(dialog)) return dialog;
      }
      await sleep(300);
    }
    throw new Error(`未找到“${titleText}”弹框`);
  }

  async function waitForDialogByText(selector, text, timeoutMs = 10000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const dialogs = Array.from(document.querySelectorAll('.weui-desktop-dialog'));
      for (const dialog of dialogs) {
        const target = Array.from(dialog.querySelectorAll(selector)).find((node) =>
          String(node.textContent || '').includes(text),
        );
        if (target && isNodeVisible(dialog)) return dialog;
      }
      await sleep(300);
    }
    throw new Error(`未找到包含“${text}”的弹框`);
  }

  async function selectCollection(payload) {
    const trigger = findFirst([
      '#js_article_tags_area .js_article_tags_label .js_article_tags_content',
      '#js_article_tags_area .js_article_tags_label',
    ]);
    if (!trigger) {
      return { filled: false, selected: '', reason: '未找到合集入口' };
    }

    trigger.click();
    let dialog;
    try {
      dialog = await waitForDialogByText('.setting-con .setting-desc', '最多添加1个合集', 5000);
    } catch (_error) {
      dialog = await waitForDialogByTitle('合集', 5000);
    }

    const selectInput = dialog.querySelector('.setting-select input.weui-desktop-form__input');
    if (!selectInput) {
      return { filled: false, selected: '', reason: '未找到合集选择输入框' };
    }

    selectInput.click();
    await sleep(800);

    const options = Array.from(dialog.querySelectorAll('.setting-select .select-opts-ul .select-opt-li')).filter((node) =>
      isNodeVisible(node),
    );
    if (!options.length) {
      return { filled: false, selected: '', reason: '未找到可选合集项' };
    }

    const preferredName = String(payload?.collection_name || payload?.collection || '').trim();
    const selectedOption =
      (preferredName
        ? options.find((node) => String(node.textContent || '').trim().includes(preferredName))
        : null) || options[0];

    const optionText = String(selectedOption.textContent || '').trim();
    selectedOption.click();
    await sleep(800);

    const confirmButton = Array.from(dialog.querySelectorAll('.weui-desktop-dialog__ft button.weui-desktop-btn_primary')).find((node) =>
      String(node.textContent || '').includes('确认'),
    );
    if (!confirmButton) {
      return { filled: false, selected: optionText, reason: '未找到合集确认按钮' };
    }
    confirmButton.click();

    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      if (!document.body.contains(dialog) || !isNodeVisible(dialog)) {
        return { filled: true, selected: optionText };
      }
      await sleep(200);
    }

    return { filled: true, selected: optionText };
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

  async function confirmCoverCropDialog() {
    const deadline = Date.now() + 15000;
    let dialog = null;
    while (Date.now() < deadline) {
      const dialogs = Array.from(document.querySelectorAll('.weui-desktop-dialog'));
      for (const candidate of dialogs) {
        const hasCropper = candidate.querySelector('.cover-edit-new');
        const title = String(candidate.querySelector('.weui-desktop-dialog__title')?.textContent || '').trim();
        if ((hasCropper || title.includes('编辑封面')) && isNodeVisible(candidate)) {
          dialog = candidate;
          break;
        }
      }
      if (dialog) break;
      await sleep(300);
    }

    if (!dialog) throw new Error('未找到编辑封面弹框');
    await sleep(1500);

    const confirmButton = Array.from(dialog.querySelectorAll('button.weui-desktop-btn_primary')).find((node) =>
      String(node.textContent || '').includes('确认'),
    );
    if (!confirmButton) throw new Error('未找到“编辑封面”弹框中的确认按钮');
    confirmButton.click();

    const hiddenDeadline = Date.now() + 15000;
    while (Date.now() < hiddenDeadline) {
      if (!document.body.contains(dialog) || !isNodeVisible(dialog)) return true;
      await sleep(300);
    }
    throw new Error('封面裁剪确认后弹框未关闭');
  }

  async function selectCoverFromContent() {
    const coverArea = await ensureCoverMenuOpened();
    const entry = await getVisibleCoverEntryBySelector(
      coverArea,
      '.js_selectCoverFromContent',
      '从正文选择',
    );
    if (!entry) throw new Error('未找到“从正文选择”入口');
    entry.click();

    const dialog = await waitForDialogByTitle('选择图片', 10000);
    const items = Array.from(dialog.querySelectorAll('.appmsg_content_img_item')).filter((node) =>
      isNodeVisible(node),
    );
    if (!items.length) throw new Error('正文中没有可选的封面图片');

    const selectedIndex = Math.floor(Math.random() * items.length);
    items[selectedIndex].click();
    await sleep(1000);

    const nextButton = Array.from(dialog.querySelectorAll('button.weui-desktop-btn_primary')).find((node) =>
      String(node.textContent || '').includes('下一步'),
    );
    if (!nextButton) throw new Error('未找到封面选择弹框“下一步”按钮');
    nextButton.click();

    await confirmCoverCropDialog();
    return {
      success: true,
      source: 'content-image-picker',
      selectedIndex,
      itemCount: items.length,
    };
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

  async function uploadCoverFile(file) {
    const input = await ensureCoverImageInput();
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));

    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      await sleep(500);
      const coverArea = getCoverArea();
      if (!coverArea) break;
      const hasPreview =
        coverArea.querySelector('.js_modifyCover') ||
        coverArea.querySelector('img') ||
        coverArea.querySelector('.cropper-wrap-box') ||
        coverArea.querySelector('.cover__preview');
      if (hasPreview) return true;
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

    return imageResults;
  }

  async function insertPayload(payload, options = {}) {
    if (!isWechatEditor()) throw new Error('当前页面不是公众号编辑页，或编辑器尚未加载完成');
    const includeTitle = options.includeTitle !== false;
    const includeAuthor = options.includeAuthor !== false;
    const includeSummary = options.includeSummary !== false;
    const includeCollection = options.includeCollection !== false;
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

    let collectionResult = { filled: false, selected: '' };
    if (includeCollection) {
      try {
        collectionResult = await selectCollection(payload);
      } catch (error) {
        collectionResult = {
          filled: false,
          selected: '',
          error: error instanceof Error ? error.message : String(error),
        };
      }
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
      collectionResult,
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
