/**
 * Event detail for block relocation
 */
export interface MoveEventDetail {
  /**
   * index the block was moved from
   */
  fromIndex: number;
  /**
   * index the block was moved to
   */
  toIndex: number;
  // 选中的block集合
  selectedBlockAndIndent?: {id: string, indent: number}[]
}

/**
 * Move event for block relocation
 */
export interface MoveEvent extends CustomEvent {
  /**
   * Override detail property of CustomEvent by MoveEvent hook
   */
  readonly detail: MoveEventDetail;
}
