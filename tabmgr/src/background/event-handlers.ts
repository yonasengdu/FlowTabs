import { DELAYS, CHROME_PROTOCOL } from './constants';
import { TabActiveInfo, TabChangeInfo } from './chrome-types';
import { ITabService } from '../core/services/ITabService';
import { container } from '../core/container/container';
import { SERVICE_KEYS } from '../core/container/ServiceKeys';

export class EventHandlers {
  private static tabService: ITabService | null = null;

  static initialize(): void {
    this.tabService = container.resolve<ITabService>(SERVICE_KEYS.TAB_SERVICE);
  }

  private static getTabService(): ITabService {
    if (!this.tabService) {
      this.tabService = container.resolve<ITabService>(SERVICE_KEYS.TAB_SERVICE);
    }
    return this.tabService;
  }

  static async handleStartup(): Promise<void> {
    const service = this.getTabService();
    await service.initialize();
    setTimeout(() => service.preloadAllTabThumbnails(), DELAYS.PRELOAD);
  }

  static async handleInstalled(): Promise<void> {
    const service = this.getTabService();
    await service.initialize();
    setTimeout(() => service.preloadAllTabThumbnails(), DELAYS.PRELOAD);
  }

  static async handleTabActivated(activeInfo: TabActiveInfo): Promise<void> {
    const service = this.getTabService();
    await service.updateMruList(activeInfo.tabId);
    await service.captureAndCacheTab(activeInfo.tabId);
  }

  static async handleTabUpdated(
    tabId: number,
    changeInfo: TabChangeInfo,
    tab: chrome.tabs.Tab
  ): Promise<void> {
    if (this.shouldCaptureTab(changeInfo, tab)) {
      const service = this.getTabService();
      await service.captureAndCacheTab(tabId);
    }
  }

  static async handleTabRemoved(tabId: number): Promise<void> {
    const service = this.getTabService();
    await service.removeTab(tabId);
  }

  static async handleTabCreated(tab: chrome.tabs.Tab): Promise<void> {
    const service = this.getTabService();
    if (tab.id) {
      await service.updateMruList(tab.id);
    }
    
    if (this.shouldPreloadNewTab(tab)) {
      setTimeout(async () => {
        const updatedTab = await chrome.tabs.get(tab.id!);
        if (updatedTab.active && updatedTab.status === 'complete') {
          await service.captureAndCacheTab(tab.id!);
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

