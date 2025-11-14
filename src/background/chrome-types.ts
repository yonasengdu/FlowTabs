// Chrome API types that aren't directly exported
export type TabActiveInfo = {
  tabId: number;
  windowId: number;
};

export type TabChangeInfo = {
  status?: string;
  url?: string;
  pinned?: boolean;
  audible?: boolean;
  discarded?: boolean;
  autoDiscardable?: boolean;
  mutedInfo?: chrome.tabs.MutedInfo;
  favIconUrl?: string;
  title?: string;
  [key: string]: any;
};

