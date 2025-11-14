import { TabInfo } from '../../shared/types';

export interface IStorageRepository {
  getMruList(): Promise<number[]>;
  saveMruList(tabIds: number[]): Promise<void>;
  getThumbnails(): Promise<Record<string, string>>;
  saveThumbnail(tabId: number, thumbnail: string): Promise<void>;
  removeThumbnail(tabId: number): Promise<void>;
  getTabData(): Promise<Record<string, TabInfo>>;
  saveTabData(tabId: number, tabData: TabInfo): Promise<void>;
  removeTabData(tabId: number): Promise<void>;
  cleanClosedTabs(openTabIds: Set<number>): Promise<void>;
}

