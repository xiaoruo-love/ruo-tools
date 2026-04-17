export function ensureStyleElement(styleId: string, cssText: string): void {
  if (document.getElementById(styleId)) {
    return;
  }

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = cssText;
  document.head.append(style);
}
