import { ITabService } from '../../core/services/ITabService';
import { ITabRepository } from '../../core/repositories/ITabRepository';
import { IStorageRepository } from '../../core/repositories/IStorageRepository';
import { IThumbnailRepository } from '../../core/repositories/IThumbnailRepository';
import { TabInfo } from '../../shared/types';
import { CHROME_PROTOCOL, THUMBNAIL_QUALITY } from '../../background/constants';
import { MruList } from './MruList';

export class TabService implements ITabService {
  
  private mruList = new MruList();
  private isInitialized = false;

  constructor(
    private tabRepository: ITabRepository,
    private storageRepository: IStorageRepository,
    private thumbnailRepository: IThumbnailRepository
  ) {}


  private getMruArray(): number[] {
    return this.mruList.toArray();
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
    
    
    return this.mruList.toArray()
      .map(id => this.createTabInfo(id, tabMap, storedTabData))
      .filter((tab): tab is TabInfo => tab !== null);
  }

  async updateMruList(tabId: number): Promise<void> {
   
    this.mruList.add(tabId);
    await this.storageRepository.saveMruList(this.getMruArray());
  }

  async removeTab(tabId: number): Promise<void> {
   
    this.mruList.remove(tabId);
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
     
    }
  }

  private async initializeMruList(tabs: chrome.tabs.Tab[], openTabIds: Set<number>): Promise<void> {
    const storedMruList = await this.storageRepository.getMruList();
    
    if (storedMruList.length > 0) {
      
      const filteredIds = storedMruList.filter(id => openTabIds.has(id));
      this.mruList.fromArray(filteredIds);
      this.addNewTabsToMruList(tabs, openTabIds);
    } else {
     
      for (const tab of tabs) {
        if (tab.id) {
          this.mruList.add(tab.id);
        }
      }
    }
    
    await this.storageRepository.saveMruList(this.getMruArray());
  }

  private addNewTabsToMruList(tabs: chrome.tabs.Tab[], openTabIds: Set<number>): void {

    for (const tab of tabs) {
      if (tab.id && !this.mruList.has(tab.id) && openTabIds.has(tab.id)) {
        this.mruList.add(tab.id);
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
    
  
    let hasChanges = false;
    for (const tab of allTabs) {
      if (tab.id && !this.mruList.has(tab.id)) {
        this.mruList.add(tab.id);
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
      
    }
  }
}

