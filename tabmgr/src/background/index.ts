import { Message } from '../shared/types';
import { EventHandlers } from './event-handlers';
import { COMMAND_NAME, CHROME_PROTOCOL } from './constants';
import { container } from '../core/container/container';
import { SERVICE_KEYS } from '../core/container/ServiceKeys';
import { ITabService } from '../core/services/ITabService';
import { ITabRepository } from '../core/repositories/ITabRepository';

// Track which tabs have content script injected for optimization
const injectedTabs = new Set<number>();

// Initialize event handlers with DI
EventHandlers.initialize();

chrome.runtime.onStartup.addListener(() => EventHandlers.handleStartup());
chrome.runtime.onInstalled.addListener(() => EventHandlers.handleInstalled());


chrome.tabs.onActivated.addListener((activeInfo) => EventHandlers.handleTabActivated(activeInfo));
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  EventHandlers.handleTabUpdated(tabId, changeInfo, tab);
  
  // If URL changes, content script is cleared - remove from injected set
  if (changeInfo.url) {
    injectedTabs.delete(tabId);
  }
});
chrome.tabs.onRemoved.addListener((tabId) => {
  EventHandlers.handleTabRemoved(tabId);
  injectedTabs.delete(tabId);
});
chrome.tabs.onCreated.addListener((tab) => EventHandlers.handleTabCreated(tab));

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'content-script-lifecycle') {
  }
});


chrome.commands.onCommand.addListener(async (command) => {
  if (command !== COMMAND_NAME) return;
  
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!canInjectScript(activeTab) || !activeTab.id) return;

  const tabId = activeTab.id;
  const message: Message = { type: 'shortcut-pressed' };
  
  // Fast path: if we know it's injected, just send message
  if (injectedTabs.has(tabId)) {
    chrome.tabs.sendMessage(tabId, message).catch(() => {
      // If message fails, script might have been removed, re-inject
      injectedTabs.delete(tabId);
    });
    return;
  }

  // Try message first (might be injected from previous session)
  try {
    await chrome.tabs.sendMessage(tabId, message);
    injectedTabs.add(tabId);
  } catch {
    // Not injected, inject now
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js'],
      });
      injectedTabs.add(tabId);
      chrome.tabs.sendMessage(tabId, message).catch(() => {});
    } catch (error) {
      console.warn(`Alt+Q: Could not inject script: ${(error as Error).message}`);
    }
  }
});


chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  if (message.type === 'capture-and-get-list') {
    handleCaptureAndGetList(sender, sendResponse);
    return true; 
  }
  
  if (message.type === 'switch-to-tab') {
    handleSwitchToTab(message.tabId);
  }
});

async function handleSwitchToTab(tabId: number): Promise<void> {
  try {
    const tabRepository = container.resolve<ITabRepository>(SERVICE_KEYS.TAB_REPOSITORY);
    
    // Just switch the tab - let Chrome's onActivated event handle MRU update
    await tabRepository.updateTab(tabId, { active: true });
  } catch (error) {
    console.error('Error switching to tab:', error);
  }
}

function canInjectScript(tab: chrome.tabs.Tab | undefined): boolean {
  return (
    tab?.id !== undefined &&
    tab.url !== undefined &&
    !tab.url.startsWith(CHROME_PROTOCOL)
  );
}

async function handleCaptureAndGetList(
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
): Promise<void> {
  try {
    if (!sender.tab?.id) {
      sendResponse([]);
      return;
    }
    
    const tabService = container.resolve<ITabService>(SERVICE_KEYS.TAB_SERVICE);
    await tabService.captureAndCacheTab(sender.tab.id);
    const tabs = await tabService.getTabDetails();
    sendResponse(tabs);
    
    // Preload in background (non-blocking)
    tabService.preloadAllTabThumbnails().catch(() => {
      // Silently fail for background preloading
    });
  } catch (error) {
    console.error('Error handling capture-and-get-list:', error);
    sendResponse([]);
  }
}
