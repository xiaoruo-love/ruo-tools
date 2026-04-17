
# 任务1: 抠图侠

背景： 我在美图秀秀抠图页面https://www.designkit.cn/cutout 上传图片后，系统会自动抠图，并将抠图完成后的图片展示在页面之中，但我无法下载（因为必须登录），我不想登录，所以我通过下面的脚本可以实现 抠图下载功能，请帮我把下面的脚本设计实现为一个完整的子应用，界面你自己设计

icon: ![alt text](../public/icons/q-image-logo.png)
参考脚本
```
(() => {
  const oldCreate = URL.createObjectURL;

  URL.createObjectURL = function (blob) {
    if (blob.type && blob.type.startsWith('image/') && blob.size > 50000) {
      const url = oldCreate.call(this, blob);

      // 发送给 background 统一下载（更稳）
      window.postMessage({
        type: 'DOWNLOAD_BLOB',
        url,
        filename: `cutout_${Date.now()}.png`
      });

      return url;
    }

    return oldCreate.call(this, blob);
  };

  console.log('[Cutout Plugin] 已启动');
})();
```

{
    id: 'q-image-helper',
    name: '抠图侠',
    description: '下载美图秀秀页面的抠图结果',
    category: 'productivity',
    version: '1.0.0',
    type: 'popup-only',
    matches: [],
    enabledByDefault: true,
  },