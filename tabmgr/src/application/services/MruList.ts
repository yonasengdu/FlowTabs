/**
 * Node in the doubly linked list
 */
class ListNode {
  tabId: number;
  prev: ListNode | null = null;
  next: ListNode | null = null;

  constructor(tabId: number) {
    this.tabId = tabId;
  }
}

/**
 * MRU (Most Recently Used) list implementation using HashMap + Doubly Linked List
 * All operations are O(1): add, remove, move to front
 * Iteration is O(n) from most recent to least recent
 */
export class MruList {
  private map: Map<number, ListNode> = new Map();
  private head: ListNode | null = null;
  private tail: ListNode | null = null;

  /**
   * Add or move a tab to the front (most recently used position)
   * O(1) operation
   */
  add(tabId: number): void {
    if (this.map.has(tabId)) {
      // Tab already exists, move to front
      this.moveToFront(tabId);
    } else {
      // New tab, add to front
      const node = new ListNode(tabId);
      this.map.set(tabId, node);
      this.addNodeToFront(node);
    }
  }

  /**
   * Remove a tab from the list
   * O(1) operation
   */
  remove(tabId: number): void {
    const node = this.map.get(tabId);
    if (!node) return;

    this.removeNode(node);
    this.map.delete(tabId);
  }

  /**
   * Check if a tab exists in the list
   * O(1) operation
   */
  has(tabId: number): boolean {
    return this.map.has(tabId);
  }

  /**
   * Get all tab IDs in MRU order (most recent first)
   * O(n) operation
   */
  toArray(): number[] {
    const result: number[] = [];
    let current = this.head;
    while (current) {
      result.push(current.tabId);
      current = current.next;
    }
    return result;
  }

  /**
   * Get the size of the list
   * O(1) operation
   */
  size(): number {
    return this.map.size;
  }

  /**
   * Clear the entire list
   * O(1) operation (garbage collector handles cleanup)
   */
  clear(): void {
    this.map.clear();
    this.head = null;
    this.tail = null;
  }

  /**
   * Initialize from an array (most recent first)
   * O(n) operation
   */
  fromArray(tabIds: number[]): void {
    this.clear();
    // Add in reverse order so first item ends up at head
    for (let i = tabIds.length - 1; i >= 0; i--) {
      this.add(tabIds[i]);
    }
  }

  // Private helper methods

  private moveToFront(tabId: number): void {
    const node = this.map.get(tabId);
    if (!node || node === this.head) return;

    // Remove from current position
    this.removeNode(node);
    // Add to front
    this.addNodeToFront(node);
  }

  private addNodeToFront(node: ListNode): void {
    node.next = this.head;
    node.prev = null;

    if (this.head) {
      this.head.prev = node;
    }

    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  private removeNode(node: ListNode): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      // Node is head
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      // Node is tail
      this.tail = node.prev;
    }
  }
}

