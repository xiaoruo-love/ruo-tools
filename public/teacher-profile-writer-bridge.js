(function () {
  if (window.__ruoruoTeacherProfileWriter__?.isInstalled) return;

  const state = {
    status: 'idle',
    selectedText: '',
    selectedTag: '',
    selectedPreview: '',
    pageTitle: document.title || '',
    pageUrl: location.href,
  };

  let overlay = null;
  let badge = null;
  let activeElement = null;
  let cleanup = null;

  function ensureUI() {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.left = '0';
      overlay.style.top = '0';
      overlay.style.width = '0';
      overlay.style.height = '0';
      overlay.style.border = '2px solid #f97316';
      overlay.style.background = 'rgba(249, 115, 22, 0.12)';
      overlay.style.boxShadow = '0 0 0 999999px rgba(15, 23, 42, 0.12)';
      overlay.style.borderRadius = '10px';
      overlay.style.pointerEvents = 'none';
      overlay.style.zIndex = '2147483646';
      overlay.style.transition = 'all 80ms ease-out';
      document.documentElement.appendChild(overlay);
    }

    if (!badge) {
      badge = document.createElement('div');
      badge.style.position = 'fixed';
      badge.style.left = '16px';
      badge.style.top = '16px';
      badge.style.maxWidth = '320px';
      badge.style.padding = '10px 12px';
      badge.style.borderRadius = '12px';
      badge.style.background = 'rgba(15, 23, 42, 0.92)';
      badge.style.color = '#fff';
      badge.style.font = '13px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      badge.style.boxShadow = '0 12px 36px rgba(15, 23, 42, 0.28)';
      badge.style.pointerEvents = 'none';
      badge.style.zIndex = '2147483647';
      document.documentElement.appendChild(badge);
    }
  }

  function setBadge(text) {
    ensureUI();
    badge.textContent = text;
  }

  function hideUI() {
    overlay?.remove();
    badge?.remove();
    overlay = null;
    badge = null;
  }

  function normalizeText(text) {
    return String(text || '')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  function isOverlayElement(el) {
    return !!(
      el &&
      ((overlay && (el === overlay || overlay.contains(el))) ||
        (badge && (el === badge || badge.contains(el))))
    );
  }

  function describeElement(el) {
    const tag = el.tagName.toLowerCase();
    const id = el.id ? `#${el.id}` : '';
    const cls =
      typeof el.className === 'string' && el.className.trim()
        ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
        : '';
    return `${tag}${id}${cls}`;
  }

  function renderOverlay(el) {
    ensureUI();
    const rect = el.getBoundingClientRect();
    overlay.style.left = `${Math.max(0, rect.left - 3)}px`;
    overlay.style.top = `${Math.max(0, rect.top - 3)}px`;
    overlay.style.width = `${Math.max(0, rect.width + 6)}px`;
    overlay.style.height = `${Math.max(0, rect.height + 6)}px`;
  }

  function finishSelection(el) {
    const text = normalizeText(el.innerText || '');
    state.status = text ? 'selected' : 'idle';
    state.selectedText = text;
    state.selectedTag = el.tagName.toLowerCase();
    state.selectedPreview = text.slice(0, 160);
    setBadge(
      text
        ? `已选中 ${describeElement(el)}，返回插件点击“生成简介”即可。`
        : `元素 ${describeElement(el)} 没有足够文本，请重试。`,
    );
    teardownEvents();
    setTimeout(() => hideUI(), 500);
  }

  function teardownEvents() {
    cleanup?.();
    cleanup = null;
    activeElement = null;
  }

  function startSelection() {
    teardownEvents();
    state.status = 'selecting';
    state.pageTitle = document.title || '';
    state.pageUrl = location.href;
    setBadge('移动鼠标选择教师履历或简介区域，单击确认，按 Esc 取消。');

    const onMove = (event) => {
      const target = document.elementFromPoint(event.clientX, event.clientY);
      if (!(target instanceof Element) || isOverlayElement(target)) return;
      activeElement = target;
      renderOverlay(target);
      setBadge(`当前元素：${describeElement(target)}。单击确认，按 Esc 取消。`);
    };

    const onClick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (!activeElement) return;
      finishSelection(activeElement);
    };

    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      state.status = 'idle';
      setBadge('已取消选区。');
      teardownEvents();
      setTimeout(() => hideUI(), 300);
    };

    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKeyDown, true);

    cleanup = () => {
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }

  function stopSelection() {
    state.status = state.selectedText ? 'selected' : 'idle';
    teardownEvents();
    hideUI();
  }

  function getSelectionState() {
    return { ...state };
  }

  function clearSelection() {
    state.status = 'idle';
    state.selectedText = '';
    state.selectedTag = '';
    state.selectedPreview = '';
    teardownEvents();
    hideUI();
    return getSelectionState();
  }

  window.__ruoruoTeacherProfileWriter__ = {
    isInstalled: true,
    startSelection,
    stopSelection,
    clearSelection,
    getSelectionState,
  };
})();
