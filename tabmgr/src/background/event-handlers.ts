import { tabManager } from './tab-manager';
import { DELAYS, CHROME_PROTOCOL } from './constants';
import { TabActiveInfo, TabChangeInfo } from './chrome-types';

export class EventHandlers {
  static async handleStartup(): Promise<void> {
    await tabManager.initialize();
    setTimeout(() => tabManager.preloadAllTabThumbnails(), DELAYS.PRELOAD);
  }

  static async handleInstalled(): Promise<void> {
    await tabManager.initialize();
    setTimeout(() => tabManager.preloadAllTabThumbnails(), DELAYS.PRELOAD);
  }

  static async handleTabActivated(activeInfo: TabActiveInfo): Promise<void> {
    tabManager.updateMruList(activeInfo.tabId);
    await tabManager.captureAndCacheTab(activeInfo.tabId);
  }

  static async handleTabUpdated(
    tabId: number,
    changeInfo: TabChangeInfo,
    tab: chrome.tabs.Tab
  ): Promise<void> {
    if (this.shouldCaptureTab(changeInfo, tab)) {
      await tabManager.captureAndCacheTab(tabId);
    }
  }

  static handleTabRemoved(tabId: number): void {
    tabManager.removeTab(tabId);
  }

  static async handleTabCreated(tab: chrome.tabs.Tab): Promise<void> {
    if (tab.id) {
      tabManager.updateMruList(tab.id);
    }
    
    if (this.shouldPreloadNewTab(tab)) {
      setTimeout(async () => {
        const updatedTab = await chrome.tabs.get(tab.id!);
        if (updatedTab.active && updatedTab.status === 'complete') {
          await tabManager.captureAndCacheTab(tab.id!);
        }
      }, DELAYS.TAB_CAPTURE);
    }
  }

  private static shouldCaptureTab(
    changeInfo: TabChangeInfo,
    tab: chrome.tabs.Tab
  ): boolean {
    return (
      changeInfo.status === 'complete' &&
      tab.active === true &&
      tab.url !== undefined &&
      !tab.url.startsWith(CHROME_PROTOCOL)
    );
  }

  private static shouldPreloadNewTab(tab: chrome.tabs.Tab): boolean {
    return (
      tab.id !== undefined &&
      tab.url !== undefined &&
      !tab.url.startsWith(CHROME_PROTOCOL) &&
      tab.active === true
    );
  }
}

