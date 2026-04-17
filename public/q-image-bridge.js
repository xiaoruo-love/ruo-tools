/**
 * q-image-bridge.js — injected into MAIN world by the 抠图侠 popup app.
 * Patches URL.createObjectURL to capture large image blobs.
 */
(function () {
  if (window.__ruoruoCutout?.isInstalled) return;

  const captures = [];
  const _origCreate = URL.createObjectURL.bind(URL);

  URL.createObjectURL = function (blob) {
    const url = _origCreate(blob);
    if (blob instanceof Blob && blob.type?.startsWith('image/') && blob.size > 50000) {
      captures.push({
        index: captures.length,
        filename: `cutout_${Date.now()}.png`,
        type: blob.type,
        size: blob.size,
        blob: blob,
        url: url,
      });
      console.log(`[抠图侠] 捕获图片 #${captures.length}，大小: ${(blob.size / 1024).toFixed(1)} KB`);
    }
    return url;
  };

  window.__ruoruoCutout = {
    isInstalled: true,

    getCaptures() {
      return captures.map((c) => ({
        index: c.index,
        filename: c.filename,
        type: c.type,
        size: c.size,
      }));
    },

    async getDataUrl(index) {
      const cap = captures[index];
      if (!cap) return null;
      const blobToRead = cap.blob instanceof Blob ? cap.blob : await fetch(cap.url).then((r) => r.blob());
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('FileReader 读取失败'));
        reader.readAsDataURL(blobToRead);
      });
    },
  };

  console.log('[抠图侠] 已启动，等待图片...');
})();
