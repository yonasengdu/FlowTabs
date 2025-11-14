export type Message = 
  | { type: 'shortcut-pressed' }
  | { type: 'capture-and-get-list' }
  | { type: 'switch-to-tab'; tabId: number };

export interface TabInfo {
  id?: number;
  title?: string;
  url?: string;
  favIconUrl?: string;
  thumbnailUrl?: string;
}