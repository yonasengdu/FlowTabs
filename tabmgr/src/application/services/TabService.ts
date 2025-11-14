import { ITabService } from '../../core/services/ITabService';
import { ITabRepository } from '../../core/repositories/ITabRepository';
import { IStorageRepository } from '../../core/repositories/IStorageRepository';
import { IThumbnailRepository } from '../../core/repositories/IThumbnailRepository';
import { TabInfo } from '../../shared/types';
import { CHROME_PROTOCOL, THUMBNAIL_QUALITY } from '../../background/constants';

export class TabService implements ITabService {
  // Map maintains insertion order, O(1) operations
  // Key: tabId, Value: order (for potential sorting, though insertion order is preserved)
  private mruTabIds = new Map<number, number>();
  private mruOrder = 0; // Counter for insertion order
  private isInitialized = false;

  constructor(
    private tabRepository: ITabRepository,
    private storageRepository: IStorageRepository,
    private thumbnailRepository: IThumbnailRepository
  ) {}

  // Convert Map to array only when needed for storage (Maps maintain insertion order)
  private getMruArray(): number[] {
    return Array.from(this.mruTabIds.keys());
  }

  async initialize(): Promise<void> {
    const tabs = await this.tabRepository.getAllTabs();
    const openTabIds = new Set(tabs.map(t => t.id).filter((id): id is number => id !== undefined));
    
    await this.initializeMruList(tabs, openTabIds);
    await this.loadCachedData(openTabIds);
    await this.storageRepository.cleanClosedTabs(openTabIds);
    
    this.isInitialized = true;
  }

  async getTabDetails(): Promise<TabInfo[]> {
    await this.ensureInitialized();
    await this.syncMruListWithOpenTabs();
    
    const allTabs = await this.tabRepository.getTabsByWindowType('normal');
    const tabMap = new Map(allTabs.map(tab => [tab.id, tab]));
    const storedTabData = await this.storageRepository.getTabData();
    
    // Map maintains insertion order, so iteration is in MRU order
    return Array.from(this.mruTabIds.keys())
      .map(id => this.createTabInfo(id, tabMap, storedTabData))
      .filter((tab): tab is TabInfo => tab !== null);
  }

  async updateMruList(tabId: number): Promise<void> {
    // O(1) delete and insert (Map maintains insertion order)
    this.mruTabIds.delete(tabId);
    this.mruTabIds.set(tabId, this.mruOrder++);
    await this.storageRepository.saveMruList(this.getMruArray());
  }

  async removeTab(tabId: number): Promise<void> {
    // O(1) delete
    this.mruTabIds.delete(tabId);
    this.thumbnailRepository.removeThumbnail(tabId);
    
    await Promise.all([
      this.storageRepository.removeThumbnail(tabId),
      this.storageRepository.removeTabData(tabId),
    ]);
    
    await this.storageRepository.saveMruList(this.getMruArray());
  }

  async captureAndCacheTab(tabId: number): Promise<void> {
    try {
      const tab = await this.tabRepository.getTabById(tabId);
      
      if (!this.canCaptureTab(tab)) {
        return;
      }

      const dataUrl = await this.tabRepository.captureVisibleTab(tab.windowId!, {
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

  async preloadAllTabThumbnails(): Promise<void> {
    try {
      const allWindows = await this.tabRepository.getAllWindows();
      const capturePromises = allWindows.map(window => this.processWindow(window));
      await Promise.allSettled(capturePromises);
    } catch (error) {
      // Silently fail for preloading
    }
  }

  private async initializeMruList(tabs: chrome.tabs.Tab[], openTabIds: Set<number>): Promise<void> {
    const storedMruList = await this.storageRepository.getMruList();
    
    if (storedMruList.length > 0) {
      // Load stored MRU list, filtering to only open tabs
      for (const id of storedMruList) {
        if (openTabIds.has(id)) {
          this.mruTabIds.set(id, this.mruOrder++);
        }
      }
      this.addNewTabsToMruList(tabs, openTabIds);
    } else {
      // First time: initialize with all tabs
      for (const tab of tabs) {
        if (tab.id) {
          this.mruTabIds.set(tab.id, this.mruOrder++);
        }
      }
    }
    
    await this.storageRepository.saveMruList(this.getMruArray());
  }

  private addNewTabsToMruList(tabs: chrome.tabs.Tab[], openTabIds: Set<number>): void {
    // O(n) iteration, but O(1) Map operations
    for (const tab of tabs) {
      if (tab.id && !this.mruTabIds.has(tab.id) && openTabIds.has(tab.id)) {
        this.mruTabIds.set(tab.id, this.mruOrder++);
      }
    }
  }

  private async loadCachedData(openTabIds: Set<number>): Promise<void> {
    const thumbnails = await this.storageRepository.getThumbnails();
    
    for (const [tabIdStr, thumbnail] of Object.entries(thumbnails)) {
      const tabId = parseInt(tabIdStr, 10);
      if (openTabIds.has(tabId)) {
        this.thumbnailRepository.cacheThumbnail(tabId, thumbnail);
      }
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  private async syncMruListWithOpenTabs(): Promise<void> {
    const allTabs = await this.tabRepository.getTabsByWindowType('normal');
    
    // O(n) iteration, but O(1) Map operations
    let hasChanges = false;
    for (const tab of allTabs) {
      if (tab.id && !this.mruTabIds.has(tab.id)) {
        this.mruTabIds.set(tab.id, this.mruOrder++);
        hasChanges = true;
      }
    }
    
    if (hasChanges) {
      await this.storageRepository.saveMruList(this.getMruArray());
    }
  }

  private createTabInfo(
    tabId: number,
    tabMap: Map<number | undefined, chrome.tabs.Tab>,
    storedTabData: Record<string, TabInfo>
  ): TabInfo | null {
    const chromeTab = tabMap.get(tabId);
    if (!chromeTab) return null;
    
    const storedData = storedTabData[tabId.toString()];
    const thumbnailUrl = this.thumbnailRepository.getCachedThumbnail(tabId);
    
    return {
      id: chromeTab.id,
      title: storedData?.title || chromeTab.title,
      url: storedData?.url || chromeTab.url,
      favIconUrl: storedData?.favIconUrl || chromeTab.favIconUrl,
      thumbnailUrl: thumbnailUrl || storedData?.thumbnailUrl || undefined,
    };
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
    this.thumbnailRepository.cacheThumbnail(tabId, thumbnail);
    
    const tabData: TabInfo = {
      id: tab.id,
      title: tab.title,
      url: tab.url,
      favIconUrl: tab.favIconUrl,
      thumbnailUrl: thumbnail,
    };
    
    await Promise.all([
      this.storageRepository.saveThumbnail(tabId, thumbnail),
      this.storageRepository.saveTabData(tabId, tabData),
    ]);
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
      const dataUrl = await this.tabRepository.captureVisibleTab(windowId, {
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
      
      await this.storageRepository.saveTabData(tab.id, tabData);
    } catch (error) {
      // Silently fail
    }
  }
}

