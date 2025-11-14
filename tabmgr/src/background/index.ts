import { Message } from '../shared/types';
import { tabManager } from './tab-manager';
import { EventHandlers } from './event-handlers';
import { COMMAND_NAME, CHROME_PROTOCOL } from './constants';

chrome.runtime.onStartup.addListener(() => EventHandlers.handleStartup());
chrome.runtime.onInstalled.addListener(() => EventHandlers.handleInstalled());


chrome.tabs.onActivated.addListener((activeInfo) => EventHandlers.handleTabActivated(activeInfo));
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) =>
  EventHandlers.handleTabUpdated(tabId, changeInfo, tab)
);
chrome.tabs.onRemoved.addListener((tabId) => EventHandlers.handleTabRemoved(tabId));
chrome.tabs.onCreated.addListener((tab) => EventHandlers.handleTabCreated(tab));

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'content-script-lifecycle') {
  }
});


chrome.commands.onCommand.addListener(async (command) => {
  if (command !== COMMAND_NAME) return;
  
  const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!canInjectScript(activeTab)) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id! },
      files: ['content.js'],
    });
    
    const message: Message = { type: 'shortcut-pressed' };
    chrome.tabs.sendMessage(activeTab.id!, message);
  } catch (error) {
    console.warn(`Alt+Q: Could not inject script: ${(error as Error).message}`);
  }
});


chrome.runtime.onMessage.addListener((message: Message, sender, sendResponse) => {
  if (message.type === 'capture-and-get-list') {
    handleCaptureAndGetList(sender, sendResponse);
    return true; 
  }
  
  if (message.type === 'switch-to-tab') {
    chrome.tabs.update(message.tabId, { active: true });
  }
});

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
    
    await tabManager.captureAndCacheTab(sender.tab.id);
    const tabs = await tabManager.getTabDetails();
    sendResponse(tabs);
    
    // Preload in background (non-blocking)
    tabManager.preloadAllTabThumbnails().catch(() => {
      // Silently fail for background preloading
    });
  } catch (error) {
    console.error('Error handling capture-and-get-list:', error);
    sendResponse([]);
  }
}
