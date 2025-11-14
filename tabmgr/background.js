// This background script is STATELESS. It only responds to events.
let mruTabIds = [];

// --- SETUP ---
chrome.runtime.onStartup.addListener(() => { initializeMruList(); });
chrome.runtime.onInstalled.addListener(() => { initializeMruList(); });
chrome.tabs.onActivated.addListener(activeInfo => updateMruList(activeInfo.tabId));
chrome.tabs.onRemoved.addListener(tabId => {
    mruTabIds = mruTabIds.filter(id => id !== tabId);
    saveMruList();
});

// --- CORE LOGIC ---
// Its only job is to inject the script and forward the keypress.
chrome.commands.onCommand.addListener(async (command) => {
    if (command !== "alt-q-switch") return;

    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab || (activeTab.url && activeTab.url.startsWith('chrome://'))) {
        return; // Silently fail on protected pages
    }

    try {
        // We inject the script every time. Chrome is smart and won't re-inject if it's there.
        // This ensures it's always available.
        await chrome.scripting.executeScript({
            target: { tabId: activeTab.id },
            files: ['content_script.js']
        });

        // Now, just tell the content script that the shortcut was pressed.
        chrome.tabs.sendMessage(activeTab.id, { type: 'shortcut-pressed' });
    } catch (e) {
        // This can happen if the page is still loading or is a special page.
        console.warn(`Alt+Q: Could not inject script into tab ${activeTab.id}: ${e.message}`);
    }
});

// The background will act as a data provider when the content script asks.
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'request-tab-list') {
        getTabDetails(mruTabIds).then(tabs => sendResponse(tabs));
        return true; // Required for async response
    } else if (message.type === 'switch-to-tab') {
        chrome.tabs.update(message.tabId, { active: true });
    }
});


// --- HELPER FUNCTIONS ---
async function initializeMruList() {
    const tabs = await chrome.tabs.query({});
    mruTabIds = tabs.map(tab => tab.id);
    const result = await chrome.storage.local.get('mruTabIds');
    if (result.mruTabIds) {
        const openTabIds = new Set(tabs.map(t => t.id));
        mruTabIds = result.mruTabIds.filter(id => openTabIds.has(id));
    }
}

function updateMruList(tabId) {
    if (!tabId) return;
    mruTabIds = mruTabIds.filter(id => id !== tabId);
    mruTabIds.unshift(tabId);
    saveMruList();
}

async function getTabDetails(tabIds) {
    const allTabs = await chrome.tabs.query({ windowType: 'normal' });
    const tabMap = new Map(allTabs.map(tab => [tab.id, tab]));
    return tabIds.map(id => tabMap.get(id)).filter(Boolean);
}

function saveMruList() {
    chrome.storage.local.set({ mruTabIds });
}