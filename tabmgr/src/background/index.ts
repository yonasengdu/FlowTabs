import { Message } from '../shared/types';
import * as TabManager from './tab-manager';


chrome.runtime.onStartup.addListener(() => TabManager.initializeMruList());
chrome.runtime.onInstalled.addListener(() => TabManager.initializeMruList());

chrome.tabs.onActivated.addListener(activeInfo => TabManager.updateMruList(activeInfo.tabId));
chrome.tabs.onRemoved.addListener(tabId => TabManager.removeTabFromMru(tabId));
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
      
        await TabManager.captureAndCacheTab(sender.tab!.id!);
        
        const tabs = await TabManager.getTabDetails();
       
        sendResponse(tabs);
    })();
    return true; 

  } else if (message.type === 'switch-to-tab') {
    chrome.tabs.update(message.tabId, { active: true });
  }
});