import { TabInfo } from '../shared/types';

export function createSwitcherUI(tabs: TabInfo[], highlightedIndex: number): void {
  injectCSS();
  const switcher = document.createElement('div');
  switcher.id = 'alt-q-switcher-overlay';
  switcher.innerHTML = `<div id="alt-q-switcher-list"></div>`;
  document.body.appendChild(switcher);

  const listElement = document.getElementById('alt-q-switcher-list') as HTMLDivElement;
  
  listElement.innerHTML = tabs.map(tab => {
      const hasThumb = !!tab.thumbnailUrl;
      const imgSrc = tab.thumbnailUrl || tab.favIconUrl || 'https://i.imgur.com/8QZ7gV5.png';
      const imgClass = hasThumb ? 'alt-q-preview-img' : 'alt-q-favicon';

      return `
      <div class="alt-q-switcher-item">
          <div class="alt-q-img-container">
            <img src="${imgSrc}" class="${imgClass}" loading="lazy" alt=""/>
          </div>
          <span class="alt-q-title">${tab.title}</span>
      </div>
  `}).join('');

  updateHighlight(highlightedIndex);
}

export function updateHighlight(index: number): void {
  const items = document.querySelectorAll('.alt-q-switcher-item');
  items.forEach((item, i) => {
    item.classList.toggle('highlighted', i === index);
  });
}

export function cleanup(): void {
  const switcher = document.getElementById('alt-q-switcher-overlay');
  if (switcher) switcher.remove();
  const styles = document.getElementById('alt-q-switcher-styles');
  if (styles) styles.remove();
}

function injectCSS(): void {
  if (document.getElementById('alt-q-switcher-styles')) return;
  const link = document.createElement('link');
  link.id = 'alt-q-switcher-styles';
  link.rel = 'stylesheet';
  link.type = 'text/css';
  link.href = chrome.runtime.getURL('switcher.css');
  (document.head || document.documentElement).appendChild(link);
}