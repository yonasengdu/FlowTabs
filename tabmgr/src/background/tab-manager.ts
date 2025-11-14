import { TabInfo } from '../shared/types';
import { StorageManager } from './storage';
import { CHROME_PROTOCOL, THUMBNAIL_QUALITY } from './constants';

class TabManager {
  private mruTabIds: number[] = [];
  private thumbnailCache = new Map<number, string>();
  private isInitialized = false;

  async initialize(): Promise<void> {
    const tabs = await chrome.tabs.query({});
    const openTabIds = new Set(tabs.map(t => t.id).filter((id): id is number => id !== undefined));
    
    await this.initializeMruList(tabs, openTabIds);
    await this.loadCachedData(openTabIds);
    await StorageManager.cleanClosedTabs(openTabIds);
    
    this.isInitialized = true;
  }

  private async initializeMruList(tabs: chrome.tabs.Tab[], openTabIds: Set<number>): Promise<void> {
    const storedMruList = await StorageManager.getMruList();
    
    if (storedMruList.length > 0) {
      this.mruTabIds = storedMruList.filter(id => openTabIds.has(id));
      this.addNewTabsToMruList(tabs, openTabIds);
    } else {
      this.mruTabIds = tabs.map(tab => tab.id).filter((id): id is number => id !== undefined);
    }
    
    await StorageManager.saveMruList(this.mruTabIds);
  }

  private addNewTabsToMruList(tabs: chrome.tabs.Tab[], openTabIds: Set<number>): void {
    const mruSet = new Set(this.mruTabIds);
    const newTabs = tabs.filter(tab => tab.id && !mruSet.has(tab.id));
    this.mruTabIds = [...this.mruTabIds, ...newTabs.map(t => t.id as number)];
  }

  private async loadCachedData(openTabIds: Set<number>): Promise<void> {
    const thumbnails = await StorageManager.getThumbnails();
    
    for (const [tabIdStr, thumbnail] of Object.entries(thumbnails)) {
      const tabId = parseInt(tabIdStr, 10);
      if (openTabIds.has(tabId)) {
        this.thumbnailCache.set(tabId, thumbnail);
      }
    }
  }

  updateMruList(tabId: number): void {
    this.mruTabIds = this.mruTabIds.filter(id => id !== tabId);
    this.mruTabIds.unshift(tabId);
    StorageManager.saveMruList(this.mruTabIds);
  }

  async removeTab(tabId: number): Promise<void> {
    this.mruTabIds = this.mruTabIds.filter(id => id !== tabId);
    this.thumbnailCache.delete(tabId);
    
    await Promise.all([
      StorageManager.removeThumbnail(tabId),
      StorageManager.removeTabData(tabId),
    ]);
    
    await StorageManager.saveMruList(this.mruTabIds);
  }

  async getTabDetails(): Promise<TabInfo[]> {
    await this.ensureInitialized();
    await this.syncMruListWithOpenTabs();
    
    const allTabs = await chrome.tabs.query({ windowType: 'normal' });
    const tabMap = new Map(allTabs.map(tab => [tab.id, tab]));
    
    const [storedThumbnails, storedTabData] = await Promise.all([
      StorageManager.getThumbnails(),
      StorageManager.getTabData(),
    ]);
    
    return this.mruTabIds
      .map(id => this.createTabInfo(id, tabMap, storedThumbnails, storedTabData))
      .filter((tab): tab is TabInfo => tab !== null);
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  private async syncMruListWithOpenTabs(): Promise<void> {
    const allTabs = await chrome.tabs.query({ windowType: 'normal' });
    const currentTabIds = new Set(allTabs.map(t => t.id).filter((id): id is number => id !== undefined));
    const mruSet = new Set(this.mruTabIds);
    
    const missingTabs = allTabs.filter(tab => tab.id && !mruSet.has(tab.id));
    if (missingTabs.length > 0) {
      this.mruTabIds = [...this.mruTabIds, ...missingTabs.map(t => t.id as number)];
      await StorageManager.saveMruList(this.mruTabIds);
    }
  }

  private createTabInfo(
    tabId: number,
    tabMap: Map<number | undefined, chrome.tabs.Tab>,
    storedThumbnails: Record<string, string>,
    storedTabData: Record<string, TabInfo>
  ): TabInfo | null {
    const chromeTab = tabMap.get(tabId);
    if (!chromeTab) return null;
    
    const storedData = storedTabData[tabId.toString()];
    const thumbnailUrl = this.getThumbnailUrl(tabId, storedThumbnails);
    
    return {
      id: chromeTab.id,
      title: storedData?.title || chromeTab.title,
      url: storedData?.url || chromeTab.url,
      favIconUrl: storedData?.favIconUrl || chromeTab.favIconUrl,
      thumbnailUrl: thumbnailUrl || storedData?.thumbnailUrl || undefined,
    };
  }

  private getThumbnailUrl(tabId: number, storedThumbnails: Record<string, string>): string | undefined {
    let thumbnailUrl = this.thumbnailCache.get(tabId);
    
    if (!thumbnailUrl && storedThumbnails[tabId.toString()]) {
      thumbnailUrl = storedThumbnails[tabId.toString()];
      this.thumbnailCache.set(tabId, thumbnailUrl);
    }
    
    return thumbnailUrl;
  }

  async captureAndCacheTab(tabId: number): Promise<void> {
    try {
      const tab = await chrome.tabs.get(tabId);
      
      if (!this.canCaptureTab(tab)) {
        return;
      }

      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId!, {
        format: 'jpeg',
        quality: THUMBNAIL_QUALITY.HIGH,
      });

      if (dataUrl) {
        await this.saveTabCapture(tabId, tab, dataUrl);
      }
    } catch (error) {
      console.warn(`Could not capture tab ${tabId}: ${(error as Error).message}`);
    }
  }

  private canCaptureTab(tab: chrome.tabs.Tab): boolean {
    return tab.active === true && 
           tab.url !== undefined && 
           !tab.url.startsWith(CHROME_PROTOCOL) &&
           tab.windowId !== undefined;
  }

  private async saveTabCapture(
    tabId: number,
    tab: chrome.tabs.Tab,
    thumbnail: string
  ): Promise<void> {
    this.thumbnailCache.set(tabId, thumbnail);
    
    const tabData: TabInfo = {
      id: tab.id,
      title: tab.title,
      url: tab.url,
      favIconUrl: tab.favIconUrl,
      thumbnailUrl: thumbnail,
    };
    
    await Promise.all([
      StorageManager.saveThumbnail(tabId, thumbnail),
      StorageManager.saveTabData(tabId, tabData),
    ]);
  }

  async preloadAllTabThumbnails(): Promise<void> {
    try {
      const allWindows = await chrome.windows.getAll({ populate: true });
      const capturePromises = allWindows.map(window => this.processWindow(window));
      await Promise.allSettled(capturePromises);
    } catch (error) {
      // Silently fail for preloading
    }
  }

  private async processWindow(window: chrome.windows.Window): Promise<void> {
    if (!window.tabs) return;
    
    const activeTab = window.tabs.find(tab => tab.active);
    if (activeTab && this.canCaptureTab(activeTab)) {
      await this.captureActiveTab(window.id!, activeTab);
    }
    
    await this.saveAllTabData(window.tabs);
  }

  private async captureActiveTab(windowId: number, activeTab: chrome.tabs.Tab): Promise<void> {
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(windowId, {
        format: 'jpeg',
        quality: THUMBNAIL_QUALITY.LOW,
      });
      
      if (dataUrl && activeTab.id) {
        await this.saveTabCapture(activeTab.id, activeTab, dataUrl);
      }
    } catch (error) {
      // Silently fail for preloading
    }
  }

  private async saveAllTabData(tabs: chrome.tabs.Tab[]): Promise<void> {
    const savePromises = tabs
      .filter(tab => tab.id && tab.url && !tab.url.startsWith(CHROME_PROTOCOL))
      .map(tab => this.saveTabDataOnly(tab));
    
    await Promise.allSettled(savePromises);
  }

  private async saveTabDataOnly(tab: chrome.tabs.Tab): Promise<void> {
    if (!tab.id) return;
    
    try {
      const tabData: TabInfo = {
        id: tab.id,
        title: tab.title,
        url: tab.url,
        favIconUrl: tab.favIconUrl,
        thumbnailUrl: undefined,
      };
      
      await StorageManager.saveTabData(tab.id, tabData);
    } catch (error) {
      // Silently fail
    }
  }
}

export const tabManager = new TabManager();

// Export functions for backward compatibility
export const initializeMruList = () => tabManager.initialize();
export const updateMruList = (tabId: number) => tabManager.updateMruList(tabId);
export const removeTabFromMru = (tabId: number) => tabManager.removeTab(tabId);
export const getTabDetails = () => tabManager.getTabDetails();
export const captureAndCacheTab = (tabId: number) => tabManager.captureAndCacheTab(tabId);
export const preloadAllTabThumbnails = () => tabManager.preloadAllTabThumbnails();
