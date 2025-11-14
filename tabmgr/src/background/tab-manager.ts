import { TabInfo } from '../shared/types';

let mruTabIds: number[] = [];

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
    saveMruList();
}

export async function getTabDetails(): Promise<TabInfo[]> {
  const allTabs = await chrome.tabs.query({ windowType: 'normal' });
  const tabMap = new Map(allTabs.map(tab => [tab.id, tab]));
  return mruTabIds
    .map(id => tabMap.get(id))
    .filter((tab): tab is chrome.tabs.Tab => !!tab);
}

function saveMruList(): void {
  chrome.storage.local.set({ mruTabIds });
}