import { TabInfo } from '../shared/types';

let mruTabIds: number[] = [];
const thumbnailCache = new Map<number, string>();
let isInitialized = false;

const STORAGE_KEY_MRU = 'mruTabIds';
const STORAGE_KEY_THUMBNAILS = 'tabThumbnails';
const STORAGE_KEY_TAB_DATA = 'tabData';

export async function initializeMruList(): Promise<void> {
  const tabs = await chrome.tabs.query({});
  const result = await chrome.storage.local.get([STORAGE_KEY_MRU, STORAGE_KEY_THUMBNAILS, STORAGE_KEY_TAB_DATA]);
  
  if (result[STORAGE_KEY_MRU]) {
    // Use stored MRU list, but filter to only open tabs
    const openTabIds = new Set(tabs.map(t => t.id));
    mruTabIds = result[STORAGE_KEY_MRU].filter((id: number) => openTabIds.has(id));
    
    // Add any new tabs that aren't in the MRU list yet
    const mruSet = new Set(mruTabIds);
    const newTabs = tabs.filter(tab => tab.id && !mruSet.has(tab.id));
    mruTabIds = [...mruTabIds, ...newTabs.map(t => t.id as number)];
  } else {
    // First time: initialize with all tabs
    mruTabIds = tabs.map(tab => tab.id as number);
  }
  
  // Save MRU list to storage
  saveMruList();
  
  const openTabIds = new Set(tabs.map(t => t.id));
  const openTabIdsSet = new Set(openTabIds);
  
  // Load thumbnails from storage for open tabs
  if (result[STORAGE_KEY_THUMBNAILS]) {
    const storedThumbnails = result[STORAGE_KEY_THUMBNAILS] as Record<string, string>;
    
    for (const [tabIdStr, thumbnail] of Object.entries(storedThumbnails)) {
      const tabId = parseInt(tabIdStr, 10);
      if (openTabIds.has(tabId)) {
        thumbnailCache.set(tabId, thumbnail);
      }
    }
    
    // Clean up thumbnails for closed tabs
    const cleanedThumbnails: Record<string, string> = {};
    for (const [tabIdStr, thumbnail] of Object.entries(storedThumbnails)) {
      const tabId = parseInt(tabIdStr, 10);
      if (openTabIdsSet.has(tabId)) {
        cleanedThumbnails[tabIdStr] = thumbnail;
      }
    }
    
    // Save cleaned thumbnails back
    await chrome.storage.local.set({ [STORAGE_KEY_THUMBNAILS]: cleanedThumbnails });
  }
  
  // Clean up tab data for closed tabs
  if (result[STORAGE_KEY_TAB_DATA]) {
    const storedTabData = result[STORAGE_KEY_TAB_DATA] as Record<string, TabInfo>;
    const cleanedTabData: Record<string, TabInfo> = {};
    
    for (const [tabIdStr, tabData] of Object.entries(storedTabData)) {
      const tabId = parseInt(tabIdStr, 10);
      if (openTabIdsSet.has(tabId)) {
        cleanedTabData[tabIdStr] = tabData;
      }
    }
    
    // Save cleaned tab data back
    await chrome.storage.local.set({ [STORAGE_KEY_TAB_DATA]: cleanedTabData });
  }
  
  isInitialized = true;
}

export function updateMruList(tabId: number): void {
  mruTabIds = mruTabIds.filter(id => id !== tabId);
  mruTabIds.unshift(tabId);
  saveMruList();
}

export function removeTabFromMru(tabId: number): void {
    mruTabIds = mruTabIds.filter(id => id !== tabId);
    thumbnailCache.delete(tabId);
    removeThumbnailFromStorage(tabId);
    removeTabDataFromStorage(tabId);
    saveMruList();
}

export async function getTabDetails(): Promise<TabInfo[]> {
  // Ensure initialization has happened
  if (!isInitialized) {
    await initializeMruList();
  }
  
  const allTabs = await chrome.tabs.query({ windowType: 'normal' });
  const tabMap = new Map(allTabs.map(tab => [tab.id, tab]));
  
  // Ensure all current tabs are in the MRU list
  const currentTabIds = new Set(allTabs.map(t => t.id));
  const mruSet = new Set(mruTabIds);
  const missingTabs = allTabs.filter(tab => tab.id && !mruSet.has(tab.id));
  if (missingTabs.length > 0) {
    // Add missing tabs to the end of MRU list
    mruTabIds = [...mruTabIds, ...missingTabs.map(t => t.id as number)];
    saveMruList();
  }
  
  // Load thumbnails and tab data from storage
  const result = await chrome.storage.local.get([STORAGE_KEY_THUMBNAILS, STORAGE_KEY_TAB_DATA]);
  const storedThumbnails = result[STORAGE_KEY_THUMBNAILS] as Record<string, string> | undefined;
  const storedTabData = result[STORAGE_KEY_TAB_DATA] as Record<string, TabInfo> | undefined;
  
  return mruTabIds
    .map(id => {
        const chromeTab = tabMap.get(id);
        if (!chromeTab) return null;
        
        // Check if we have stored tab data (from preloading)
        const storedData = storedTabData?.[id.toString()];
        
        // Check memory cache first, then storage for thumbnails
        let thumbnailUrl = thumbnailCache.get(id);
        if (!thumbnailUrl && storedThumbnails) {
          thumbnailUrl = storedThumbnails[id.toString()];
          if (thumbnailUrl) {
            // Load into memory cache for faster access
            thumbnailCache.set(id, thumbnailUrl);
          }
        }
        
        // Use stored data if available, otherwise use current tab data
        return {
            id: chromeTab.id,
            title: storedData?.title || chromeTab.title,
            url: storedData?.url || chromeTab.url,
            favIconUrl: storedData?.favIconUrl || chromeTab.favIconUrl,
            thumbnailUrl: thumbnailUrl || storedData?.thumbnailUrl || undefined
        } as TabInfo;
    })
    .filter((tab): tab is TabInfo => !!tab);
}

function saveMruList(): void {
  chrome.storage.local.set({ [STORAGE_KEY_MRU]: mruTabIds });
}

async function saveThumbnailToStorage(tabId: number, thumbnail: string): Promise<void> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY_THUMBNAILS);
    const thumbnails = result[STORAGE_KEY_THUMBNAILS] || {};
    thumbnails[tabId.toString()] = thumbnail;
    await chrome.storage.local.set({ [STORAGE_KEY_THUMBNAILS]: thumbnails });
  } catch (e) {
    console.warn(`Could not save thumbnail to storage: ${(e as Error).message}`);
  }
}

async function removeThumbnailFromStorage(tabId: number): Promise<void> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY_THUMBNAILS);
    if (result[STORAGE_KEY_THUMBNAILS]) {
      const thumbnails = result[STORAGE_KEY_THUMBNAILS] as Record<string, string>;
      delete thumbnails[tabId.toString()];
      await chrome.storage.local.set({ [STORAGE_KEY_THUMBNAILS]: thumbnails });
    }
  } catch (e) {
    console.warn(`Could not remove thumbnail from storage: ${(e as Error).message}`);
  }
}

async function saveTabDataToStorage(tabId: number, tabData: TabInfo): Promise<void> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY_TAB_DATA);
    const tabDataStorage = result[STORAGE_KEY_TAB_DATA] || {};
    tabDataStorage[tabId.toString()] = tabData;
    await chrome.storage.local.set({ [STORAGE_KEY_TAB_DATA]: tabDataStorage });
  } catch (e) {
    console.warn(`Could not save tab data to storage: ${(e as Error).message}`);
  }
}

async function removeTabDataFromStorage(tabId: number): Promise<void> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY_TAB_DATA);
    if (result[STORAGE_KEY_TAB_DATA]) {
      const tabDataStorage = result[STORAGE_KEY_TAB_DATA] as Record<string, TabInfo>;
      delete tabDataStorage[tabId.toString()];
      await chrome.storage.local.set({ [STORAGE_KEY_TAB_DATA]: tabDataStorage });
    }
  } catch (e) {
    console.warn(`Could not remove tab data from storage: ${(e as Error).message}`);
  }
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
            // Persist to storage
            await saveThumbnailToStorage(tabId, dataUrl);
            
            // Save complete tab data
            const tabData: TabInfo = {
                id: tab.id,
                title: tab.title,
                url: tab.url,
                favIconUrl: tab.favIconUrl,
                thumbnailUrl: dataUrl
            };
            await saveTabDataToStorage(tabId, tabData);
        }
    } catch (e) {
        console.warn(`Could not capture tab ${tabId}: ${(e as Error).message}`);
    }
}

export async function preloadAllTabThumbnails(): Promise<void> {
    try {
        const allWindows = await chrome.windows.getAll({ populate: true });
        
        // Capture thumbnails and save tab data for all visible tabs across all windows
        const capturePromises = allWindows.map(async (window) => {
            if (!window.tabs) return;
            
            // Get the active tab in this window
            const activeTab = window.tabs.find(tab => tab.active);
            if (activeTab && activeTab.id && activeTab.url && !activeTab.url.startsWith('chrome://')) {
                try {
                    const dataUrl = await chrome.tabs.captureVisibleTab(window.id!, {
                        format: 'jpeg',
                        quality: 40 // Lower quality for preloading
                    });
                    
                    if (dataUrl && activeTab.id) {
                        thumbnailCache.set(activeTab.id, dataUrl);
                        // Persist thumbnail to storage
                        await saveThumbnailToStorage(activeTab.id, dataUrl);
                        
                        // Save complete tab data
                        const tabData: TabInfo = {
                            id: activeTab.id,
                            title: activeTab.title,
                            url: activeTab.url,
                            favIconUrl: activeTab.favIconUrl,
                            thumbnailUrl: dataUrl
                        };
                        await saveTabDataToStorage(activeTab.id, tabData);
                    }
                } catch (e) {
                    // Silently fail for preloading
                }
            }
            
            // Also save tab data for all tabs in the window (even if we can't capture thumbnails)
            for (const tab of window.tabs) {
                if (tab.id && tab.url && !tab.url.startsWith('chrome://')) {
                    try {
                        const tabData: TabInfo = {
                            id: tab.id,
                            title: tab.title,
                            url: tab.url,
                            favIconUrl: tab.favIconUrl,
                            thumbnailUrl: undefined
                        };
                        await saveTabDataToStorage(tab.id, tabData);
                    } catch (e) {
                        // Silently fail
                    }
                }
            }
        });
        
        await Promise.allSettled(capturePromises);
    } catch (e) {
        // Silently fail for preloading
    }
}