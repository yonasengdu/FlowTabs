import { TabInfo } from '../shared/types';
import { UI_IDS } from './constants';
import { DEFAULT_FAVICON } from '../shared/constants';

const CSS_URL = chrome.runtime.getURL('switcher.css');

export class UIManager {
  static createSwitcherUI(tabs: TabInfo[], highlightedIndex: number): void {
    this.cleanup();
    this.injectCSS();
    this.createOverlay();
    this.renderTabs(tabs);
    this.updateHighlight(highlightedIndex);
  }

  static updateHighlight(index: number): void {
    const items = document.querySelectorAll('.alt-q-switcher-item');
    const listElement = document.getElementById(UI_IDS.LIST);
    
    items.forEach((item, i) => {
      item.classList.toggle('highlighted', i === index);
    });

    this.scrollToHighlightedItem(listElement, items[index] as HTMLElement);
  }

  static cleanup(): void {
    const switcher = document.getElementById(UI_IDS.OVERLAY);
    if (switcher) switcher.remove();
    
    const styles = document.getElementById(UI_IDS.STYLES);
    if (styles) styles.remove();
  }

  private static injectCSS(): void {
    if (document.getElementById(UI_IDS.STYLES)) return;
    
    const link = document.createElement('link');
    link.id = UI_IDS.STYLES;
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = CSS_URL;
    (document.head || document.documentElement).appendChild(link);
  }

  private static createOverlay(): void {
    const switcher = document.createElement('div');
    switcher.id = UI_IDS.OVERLAY;
    switcher.innerHTML = `<div id="${UI_IDS.LIST}"></div>`;
    document.body.appendChild(switcher);
  }

  private static renderTabs(tabs: TabInfo[]): void {
    const listElement = document.getElementById(UI_IDS.LIST) as HTMLDivElement;
    if (!listElement) return;

    listElement.innerHTML = tabs.map(tab => this.createTabHTML(tab)).join('');
  }

  private static createTabHTML(tab: TabInfo): string {
    const hasThumb = !!tab.thumbnailUrl;
    const imgSrc = tab.thumbnailUrl || tab.favIconUrl || DEFAULT_FAVICON;
    const imgClass = hasThumb ? 'alt-q-preview-img' : 'alt-q-favicon';

    return `
      <div class="alt-q-switcher-item">
        <div class="alt-q-img-container">
          <img src="${imgSrc}" class="${imgClass}" loading="lazy" alt=""/>
        </div>
        <span class="alt-q-title">${tab.title || ''}</span>
      </div>
    `;
  }

  private static scrollToHighlightedItem(
    container: HTMLElement | null,
    item: HTMLElement | undefined
  ): void {
    if (!container || !item) return;

    const containerRect = container.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();

    if (itemRect.top < containerRect.top) {
      item.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (itemRect.bottom > containerRect.bottom) {
      item.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }
}

// Export functions for backward compatibility
export const createSwitcherUI = (tabs: TabInfo[], highlightedIndex: number) =>
  UIManager.createSwitcherUI(tabs, highlightedIndex);

export const updateHighlight = (index: number) => UIManager.updateHighlight(index);

export const cleanup = () => UIManager.cleanup();
