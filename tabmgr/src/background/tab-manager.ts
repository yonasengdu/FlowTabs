import { TabInfo } from '../shared/types';

let mruTabIds: number[] = [];
const thumbnailCache = new Map<number, string>();

export async function initializeMruList(): Promise<void> {
  const tabs = await chrome.tabs.query({});
  mruTabIds = tabs.map(tab => tab.id as number);
  const result = await chrome.storage.local.get('mruTabIds');
  if (result.mruTabIds) {
    const openTabIds = new Set(tabs.map(t => t.id));
    mruTabIds = result.mruTabIds.filter((id: number) => openTabIds.has(id));
  }
}

export function updateMruList(tabId: number): void {
  mruTabIds = mruTabIds.filter(id => id !== tabId);
  mruTabIds.unshift(tabId);
  saveMruList();
}

export function removeTabFromMru(tabId: number): void {
    mruTabIds = mruTabIds.filter(id => id !== tabId);
    thumbnailCache.delete(tabId);
    saveMruList();
}

export async function getTabDetails(): Promise<TabInfo[]> {
  const allTabs = await chrome.tabs.query({ windowType: 'normal' });
  const tabMap = new Map(allTabs.map(tab => [tab.id, tab]));
  
  return mruTabIds
    .map(id => {
        const chromeTab = tabMap.get(id);
        if (!chromeTab) return null;
        
        return {
            id: chromeTab.id,
            title: chromeTab.title,
            url: chromeTab.url,
            favIconUrl: chromeTab.favIconUrl,
            thumbnailUrl: thumbnailCache.get(id) || undefined
        } as TabInfo;
    })
    .filter((tab): tab is TabInfo => !!tab);
}

function saveMruList(): void {
  chrome.storage.local.set({ mruTabIds });
}

export async function captureAndCacheTab(tabId: number): Promise<void> {
    try {
        const tab = await chrome.tabs.get(tabId);
        if (!tab.active || tab.url?.startsWith('chrome://')) {
             // Only capture if it's the truly active tab, and not protected.
            return;
        }

        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
            format: 'jpeg',
            quality: 50 // Slightly higher quality as it's a direct user action
        });

        if (dataUrl) {
            thumbnailCache.set(tabId, dataUrl);
        }
    } catch (e) {
        console.warn(`Could not capture tab ${tabId}: ${(e as Error).message}`);
    }
}