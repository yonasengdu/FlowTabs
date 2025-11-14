
class ListNode {
  tabId: number;
  prev: ListNode | null = null;
  next: ListNode | null = null;

  constructor(tabId: number) {
    this.tabId = tabId;
  }
}


export class MruList {
  private map: Map<number, ListNode> = new Map();
  private head: ListNode | null = null;
  private tail: ListNode | null = null;


  add(tabId: number): void {
    if (this.map.has(tabId)) {
    
      this.moveToFront(tabId);
    } else {
    
      const node = new ListNode(tabId);
      this.map.set(tabId, node);
      this.addNodeToFront(node);
    }
  }

 
  remove(tabId: number): void {
    const node = this.map.get(tabId);
    if (!node) return;

    this.removeNode(node);
    this.map.delete(tabId);
  }

 
  has(tabId: number): boolean {
    return this.map.has(tabId);
  }

  toArray(): number[] {
    const result: number[] = [];
    let current = this.head;
    while (current) {
      result.push(current.tabId);
      current = current.next;
    }
    return result;
  }


  size(): number {
    return this.map.size;
  }

 
  clear(): void {
    this.map.clear();
    this.head = null;
    this.tail = null;
  }


  fromArray(tabIds: number[]): void {
    this.clear();
    
    for (let i = tabIds.length - 1; i >= 0; i--) {
      this.add(tabIds[i]);
    }
  }



  private moveToFront(tabId: number): void {
    const node = this.map.get(tabId);
    if (!node || node === this.head) return;

  
    this.removeNode(node);
    
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
      
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
     
      this.tail = node.prev;
    }
  }
}

