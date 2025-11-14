import { ITabRepository, CaptureOptions } from '../../core/repositories/ITabRepository';

export class ChromeTabRepository implements ITabRepository {
  async getAllTabs(): Promise<chrome.tabs.Tab[]> {
    return chrome.tabs.query({});
  }

  async getTabById(tabId: number): Promise<chrome.tabs.Tab> {
    return chrome.tabs.get(tabId);
  }

  async getTabsByWindowType(windowType: string): Promise<chrome.tabs.Tab[]> {
    return chrome.tabs.query({ windowType: windowType as chrome.windows.WindowType });
  }

  async updateTab(tabId: number, updateProperties: chrome.tabs.UpdateProperties): Promise<chrome.tabs.Tab | undefined> {
    return chrome.tabs.update(tabId, updateProperties);
  }

  async captureVisibleTab(windowId: number, options: CaptureOptions): Promise<string> {
    return chrome.tabs.captureVisibleTab(windowId, options);
  }

  async getAllWindows(): Promise<chrome.windows.Window[]> {
    return chrome.windows.getAll({ populate: true });
  }
}

