import { Message } from '../shared/types';
import * as TabManager from './tab-manager';


chrome.runtime.onStartup.addListener(async () => {
    await TabManager.initializeMruList();
    // Preload thumbnails after a short delay to ensure tabs are ready
    setTimeout(() => TabManager.preloadAllTabThumbnails(), 1000);
});
chrome.runtime.onInstalled.addListener(async () => {
    await TabManager.initializeMruList();
    // Preload thumbnails after a short delay to ensure tabs are ready
    setTimeout(() => TabManager.preloadAllTabThumbnails(), 1000);
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
    TabManager.updateMruList(activeInfo.tabId);
    // Capture thumbnail for the newly activated tab
    await TabManager.captureAndCacheTab(activeInfo.tabId);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    // Preload thumbnail when tab finishes loading and becomes active
    if (changeInfo.status === 'complete' && tab.active && tab.url && !tab.url.startsWith('chrome://')) {
        await TabManager.captureAndCacheTab(tabId);
    }
});

chrome.tabs.onRemoved.addListener(tabId => TabManager.removeTabFromMru(tabId));

chrome.tabs.onCreated.addListener(async (tab) => {
    // Add new tab to MRU list
    if (tab.id) {
        TabManager.updateMruList(tab.id);
    }
    
    // Preload thumbnail for new tabs after they load
    if (tab.id && tab.url && !tab.url.startsWith('chrome://') && tab.active) {
        // Wait a bit for the tab to finish loading, then capture
        setTimeout(async () => {
            const updatedTab = await chrome.tabs.get(tab.id!);
            if (updatedTab.active && updatedTab.status === 'complete') {
                await TabManager.captureAndCacheTab(tab.id!);
            }
        }, 500);
    }
});
chrome.runtime.onConnect.addListener(port => {
    if (port.name === 'content-script-lifecycle') {}
});


chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "alt-q-switch") return;
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!activeTab?.id || (activeTab.url && activeTab.url.startsWith('chrome://'))) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      files: ['content.js'],
    });
    const message: Message = { type: 'shortcut-pressed' };
    chrome.tabs.sendMessage(activeTab.id, message);
  } catch (e) {
    console.warn(`Alt+Q: Could not inject script: ${(e as Error).message}`);
  }
});

chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  if (message.type === 'capture-and-get-list') {
   
    (async () => {
        // Capture the current active tab first (blocking for immediate display)
        await TabManager.captureAndCacheTab(sender.tab!.id!);
        
        // Get tabs immediately
        const tabs = await TabManager.getTabDetails();
       
        sendResponse(tabs);
        
        // Preload all tab thumbnails in background (non-blocking)
        TabManager.preloadAllTabThumbnails().catch(() => {
            // Silently fail for background preloading
        });
    })();
    return true; 

  } else if (message.type === 'switch-to-tab') {
    chrome.tabs.update(message.tabId, { active: true });
  }
});