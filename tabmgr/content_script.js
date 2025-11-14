let ui = {
    isVisible: false,
    tabs: [],
    highlightedIndex: 0
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'shortcut-pressed') {
        handleShortcutPress();
    }
});

async function handleShortcutPress() {
    if (!ui.isVisible) {
       
        const tabs = await chrome.runtime.sendMessage({ type: 'request-tab-list' });
        if (!tabs || tabs.length === 0) return; // No tabs to show

        ui.tabs = tabs;
        ui.highlightedIndex = tabs.length > 1 ? 1 : 0;
        ui.isVisible = true;

        createSwitcherUI();
        window.addEventListener('keyup', handleAltUp, { capture: true });

    } else {
        
        ui.highlightedIndex = (ui.highlightedIndex + 1) % ui.tabs.length;
        updateHighlight();
    }
}

function handleAltUp(e) {
    if (e.key === 'Alt') {
        e.stopImmediatePropagation();
        e.preventDefault();

        if (ui.isVisible) {
            const selectedTab = ui.tabs[ui.highlightedIndex];
            if (selectedTab) {
                
                chrome.runtime.sendMessage({ type: 'switch-to-tab', tabId: selectedTab.id });
            }
            cleanup();
        }
    }
}

function createSwitcherUI() {
    injectCSS();
    const switcher = document.createElement('div');
    switcher.id = 'alt-q-switcher-overlay';
    switcher.innerHTML = `<div id="alt-q-switcher-list"></div>`;
    document.body.appendChild(switcher);

    const listElement = document.getElementById('alt-q-switcher-list');
    listElement.innerHTML = ui.tabs.map(tab => `
        <div class="alt-q-switcher-item">
            <img src="${tab.favIconUrl || 'https://i.imgur.com/8QZ7gV5.png'}" class="alt-q-favicon" alt=""/>
            <span class="alt-q-title">${tab.title}</span>
        </div>
    `).join('');

    updateHighlight();
    
    switcher.addEventListener('click', (e) => {
        if (e.target.id === 'alt-q-switcher-overlay') cleanup(); // Click away to cancel
    });
}

function updateHighlight() {
    const items = document.querySelectorAll('.alt-q-switcher-item');
    items.forEach((item, i) => {
        item.classList.toggle('highlighted', i === ui.highlightedIndex);
    });
}

function cleanup() {
    ui.isVisible = false;
    const switcher = document.getElementById('alt-q-switcher-overlay');
    if (switcher) switcher.remove();
    const styles = document.getElementById('alt-q-switcher-styles');
    if (styles) styles.remove();
    window.removeEventListener('keyup', handleAltUp, { capture: true });
}

function injectCSS() {
    if (document.getElementById('alt-q-switcher-styles')) return;
    const link = document.createElement('link');
    link.id = 'alt-q-switcher-styles';
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = chrome.runtime.getURL('switcher.css');
    (document.head || document.documentElement).appendChild(link);
}