import { TabInfo } from '../../shared/types';

export interface ITabService {
  initialize(): Promise<void>;
  getTabDetails(): Promise<TabInfo[]>;
  updateMruList(tabId: number): Promise<void>;
  removeTab(tabId: number): Promise<void>;
  captureAndCacheTab(tabId: number): Promise<void>;
  preloadAllTabThumbnails(): Promise<void>;
}

