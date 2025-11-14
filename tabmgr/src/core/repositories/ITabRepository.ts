export interface CaptureOptions {
  format?: 'jpeg' | 'png';
  quality?: number;
}

export interface ITabRepository {
  getAllTabs(): Promise<chrome.tabs.Tab[]>;
  getTabById(tabId: number): Promise<chrome.tabs.Tab>;
  getTabsByWindowType(windowType: string): Promise<chrome.tabs.Tab[]>;
  updateTab(tabId: number, updateProperties: chrome.tabs.UpdateProperties): Promise<chrome.tabs.Tab | undefined>;
  captureVisibleTab(windowId: number, options: CaptureOptions): Promise<string>;
  getAllWindows(): Promise<chrome.windows.Window[]>;
}

