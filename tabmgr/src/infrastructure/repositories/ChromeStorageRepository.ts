import { IStorageRepository } from '../../core/repositories/IStorageRepository';
import { TabInfo } from '../../shared/types';

const STORAGE_KEYS = {
  MRU: 'mruTabIds',
  THUMBNAILS: 'tabThumbnails',
  TAB_DATA: 'tabData',
} as const;

export class ChromeStorageRepository implements IStorageRepository {
  async getMruList(): Promise<number[]> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.MRU);
    return result[STORAGE_KEYS.MRU] || [];
  }

  async saveMruList(tabIds: number[]): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.MRU]: tabIds });
  }

  async getThumbnails(): Promise<Record<string, string>> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.THUMBNAILS);
    return (result[STORAGE_KEYS.THUMBNAILS] as Record<string, string>) || {};
  }

  async saveThumbnail(tabId: number, thumbnail: string): Promise<void> {
    const thumbnails = await this.getThumbnails();
    thumbnails[tabId.toString()] = thumbnail;
    await chrome.storage.local.set({ [STORAGE_KEYS.THUMBNAILS]: thumbnails });
  }

  async removeThumbnail(tabId: number): Promise<void> {
    const thumbnails = await this.getThumbnails();
    delete thumbnails[tabId.toString()];
    await chrome.storage.local.set({ [STORAGE_KEYS.THUMBNAILS]: thumbnails });
  }

  async getTabData(): Promise<Record<string, TabInfo>> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.TAB_DATA);
    return (result[STORAGE_KEYS.TAB_DATA] as Record<string, TabInfo>) || {};
  }

  async saveTabData(tabId: number, tabData: TabInfo): Promise<void> {
    const tabDataStorage = await this.getTabData();
    tabDataStorage[tabId.toString()] = tabData;
    await chrome.storage.local.set({ [STORAGE_KEYS.TAB_DATA]: tabDataStorage });
  }

  async removeTabData(tabId: number): Promise<void> {
    const tabDataStorage = await this.getTabData();
    delete tabDataStorage[tabId.toString()];
    await chrome.storage.local.set({ [STORAGE_KEYS.TAB_DATA]: tabDataStorage });
  }

  async cleanClosedTabs(openTabIds: Set<number>): Promise<void> {
    const [thumbnails, tabData] = await Promise.all([
      this.getThumbnails(),
      this.getTabData(),
    ]);

    const cleanedThumbnails = this.filterByOpenTabs(thumbnails, openTabIds);
    const cleanedTabData = this.filterByOpenTabs(tabData, openTabIds);

    await Promise.all([
      chrome.storage.local.set({ [STORAGE_KEYS.THUMBNAILS]: cleanedThumbnails }),
      chrome.storage.local.set({ [STORAGE_KEYS.TAB_DATA]: cleanedTabData }),
    ]);
  }

  private filterByOpenTabs<T>(data: Record<string, T>, openTabIds: Set<number>): Record<string, T> {
    const filtered: Record<string, T> = {};
    for (const [tabIdStr, value] of Object.entries(data)) {
      const tabId = parseInt(tabIdStr, 10);
      if (openTabIds.has(tabId)) {
        filtered[tabIdStr] = value;
      }
    }
    return filtered;
  }
}

