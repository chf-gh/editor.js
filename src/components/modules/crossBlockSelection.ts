import Module from '../__module';
import Block from '../block';
import SelectionUtils from '../selection';
import * as _ from '../utils';

/**
 *
 */
export default class CrossBlockSelection extends Module {
  /**
   * Block where selection is started
   */
  private firstSelectedBlock: Block;

  /**
   * Last selected Block
   */
  private lastSelectedBlock: Block;

  /**
   * Module preparation
   *
   * @returns {Promise}
   */
  public async prepare(): Promise<void> {
    this.listeners.on(document, 'mousedown', (event: MouseEvent) => {
      this.enableCrossBlockSelection(event);
    });
  }

  /**
   * Sets up listeners
   *
   * @param {MouseEvent} event - mouse down event
   */
  public watchSelection(event: MouseEvent): void {
    if (event.button !== _.mouseButtons.LEFT) {
      return;
    }

    const { BlockManager } = this.Editor;

    this.firstSelectedBlock = BlockManager.getBlock(event.target as HTMLElement);
    this.firstSelectedBlockIndex = BlockManager.getBlockIndex(this.firstSelectedBlock);
    this.endSelectedBlockIndex = this.firstSelectedBlockIndex;
    this.lastSelectedBlock = this.firstSelectedBlock;

    this.listeners.on(document, 'mouseover', this.onMouseOver);
    this.listeners.on(document, 'mouseup', this.onMouseUp);
  }

  /**
   * Return boolean is cross block selection started:
   * there should be at least 2 selected blocks
   */
  public get isCrossBlockSelectionStarted(): boolean {
    return !!this.firstSelectedBlock && !!this.lastSelectedBlock && this.firstSelectedBlock !== this.lastSelectedBlock;
  }

  /**
   * Change selection state of the next Block
   * Used for CBS via Shift + arrow keys
   *
   * @param {boolean} next - if true, toggle next block. Previous otherwise
   */
  public toggleBlockSelectedState(next = true): void {
    const { BlockManager, BlockSelection } = this.Editor;

    if (!this.lastSelectedBlock) {
      this.lastSelectedBlock = this.firstSelectedBlock = BlockManager.currentBlock;
    }

    if (this.firstSelectedBlock === this.lastSelectedBlock) {
      this.firstSelectedBlock.selected = true;

      BlockSelection.clearCache();
      SelectionUtils.get().removeAllRanges();
    }

    const nextBlockIndex = BlockManager.blocks.indexOf(this.lastSelectedBlock) + (next ? 1 : -1);
    const nextBlock = BlockManager.blocks[nextBlockIndex];

    if (!nextBlock) {
      return;
    }

    if (this.lastSelectedBlock.selected !== nextBlock.selected) {
      nextBlock.selected = true;

      BlockSelection.clearCache();
    } else {
      this.lastSelectedBlock.selected = false;

      BlockSelection.clearCache();
    }

    this.lastSelectedBlock = nextBlock;

    /** close InlineToolbar when Blocks selected */
    this.Editor.InlineToolbar.close();

    nextBlock.holder.scrollIntoView({
      block: 'nearest',
    });
  }

  /**
   * Clear saved state
   *
   * @param {Event} reason - event caused clear of selection
   */
  public clear(reason?: Event): void {
    const { BlockManager, BlockSelection, Caret } = this.Editor;
    const fIndex = BlockManager.blocks.indexOf(this.firstSelectedBlock);
    const lIndex = BlockManager.blocks.indexOf(this.lastSelectedBlock);

    if (BlockSelection.anyBlockSelected && fIndex > -1 && lIndex > -1) {
      if (reason && reason instanceof KeyboardEvent) {
        /**
         * Set caret depending on pressed key if pressed key is an arrow.
         */
        switch (reason.keyCode) {
          case _.keyCodes.DOWN:
          case _.keyCodes.RIGHT:
            Caret.setToBlock(BlockManager.blocks[Math.max(fIndex, lIndex)], Caret.positions.END);
            break;

          case _.keyCodes.UP:
          case _.keyCodes.LEFT:
            Caret.setToBlock(BlockManager.blocks[Math.min(fIndex, lIndex)], Caret.positions.START);
            break;
          default:
            Caret.setToBlock(BlockManager.blocks[Math.max(fIndex, lIndex)], Caret.positions.END);
        }
      }
    }

    this.firstSelectedBlock = this.lastSelectedBlock = null;
  }

  /**
   * Enables Cross Block Selection
   *
   * @param {MouseEvent} event - mouse down event
   */
  private enableCrossBlockSelection(event: MouseEvent): void {
    const { UI } = this.Editor;

    /**
     * Each mouse down on must disable selectAll state
     */
    if (!SelectionUtils.isCollapsed) {
      this.Editor.BlockSelection.clearSelection(event);
    }

    /**
     * If mouse down is performed inside the editor, we should watch CBS
     */
    if (UI.nodes.redactor.contains(event.target as Node)) {
      this.watchSelection(event);
    } else {
      /**
       * Otherwise, clear selection
       */
      this.Editor.BlockSelection.clearSelection(event);
    }
  }

  /**
   * Mouse up event handler.
   * Removes the listeners
   */
  private onMouseUp = (): void => {
    this.listeners.off(document, 'mouseover', this.onMouseOver);
    this.listeners.off(document, 'mouseup', this.onMouseUp);
  };

  /**
   * Mouse over event handler
   * Gets target and related blocks and change selected state for blocks in between
   *
   * @param {MouseEvent} event - mouse over event
   */
  private onMouseOver = (event: MouseEvent): void => {
    const { BlockManager, BlockSelection } = this.Editor;

    /**
     * Probably, editor is not initialized yet
     */
    if (event.relatedTarget === null && event.target === null) {
      return;
    }

    const relatedBlock = BlockManager.getBlockByChildNode(event.relatedTarget as Node) || this.lastSelectedBlock;
    const targetBlock = BlockManager.getBlockByChildNode(event.target as Node);

    if (!relatedBlock || !targetBlock) {
      return;
    }

    if (targetBlock === relatedBlock) {
      return;
    }

    if (relatedBlock === this.firstSelectedBlock) {
      SelectionUtils.get().removeAllRanges();

      relatedBlock.selected = true;
      targetBlock.selected = true;

      BlockSelection.clearCache();

      return;
    }

    //
    if (targetBlock === this.firstSelectedBlock) {
      relatedBlock.selected = false;
      targetBlock.selected = false;
      // 检查有没有被选择的，解决场景:向下选择-》移除编辑器-》移入编辑器并选中上面的block
      if (this.firstSelectedBlockIndex !== this.endSelectedBlockIndex) {
        for (let i = Math.min(this.firstSelectedBlockIndex,this.endSelectedBlockIndex); i <= Math.max(this.firstSelectedBlockIndex,this.endSelectedBlockIndex); i++) {
          BlockManager.blocks[i].selected = false;
        }
      }

      BlockSelection.clearCache();

      return;
    }

    this.Editor.InlineToolbar.close();

    this.toggleBlocksSelectedState(relatedBlock, targetBlock);
    this.lastSelectedBlock = targetBlock;
  };

  /**
   * Change blocks selection state between passed two blocks.
   *
   * @param {Block} relateBlock - 上一个block
   * @param {Block} targetBlock - 当前block
   */
  private toggleBlocksSelectedState(relateBlock: Block, targetBlock: Block): void {
    const { BlockManager, BlockSelection } = this.Editor;
    const relateIndex = BlockManager.blocks.indexOf(relateBlock);
    const targetIndex = BlockManager.blocks.indexOf(targetBlock);
    console.log('relateIndex==',relateIndex);
    console.log('targetIndex==',targetIndex);
    console.log('this.firstSelectedBlockIndex==',this.firstSelectedBlockIndex);
    console.log('this.endSelectedBlockIndex==',this.endSelectedBlockIndex);
    // 选处理取消选中的，后处理选中的（否则级联选中有问题）
    // 区域外已选中的取消选中
    // 判断方向
    if (targetIndex > this.firstSelectedBlockIndex) {
      // 向下选择
      if (targetIndex < relateIndex) {
        // 向内回收,使用targetIndex + 1而不使用 relateIndex，解决场景：向下选择-》移除编辑器-》移入编辑器并选中上面的block
        for (let i = targetIndex + 1; i <= this.endSelectedBlockIndex; i++) {
          BlockManager.blocks[i].selected = false;
        }
      }
      // 防止回环选择，场景：向上选择后移除editor，越过起始block再向下移入editor
      if (relateIndex < this.firstSelectedBlockIndex) {
        for (let i = relateIndex; i < this.firstSelectedBlockIndex; i++) {
          BlockManager.blocks[i].selected = false;
        }
      }
    } else {
      // 向上选择 使用targetIndex而不使用 relateIndex，解决场景：向下选择-》移除编辑器-》移入编辑器并选中上面的block
      if (targetIndex > relateIndex ) {
        // 向内回收
        for (let i = this.endSelectedBlockIndex; i < targetIndex; i++) {
          BlockManager.blocks[i].selected = false;
        }
      }
      // 防止回环选择，场景：向下选择后移除editor，越过起始block再向上移入editor
      if (relateIndex > this.firstSelectedBlockIndex) {
        for (let i = this.firstSelectedBlockIndex + 1; i <= relateIndex; i++) {
          BlockManager.blocks[i].selected = false;
        }
      }
    }

    // 区域内所有选中-》考虑子级block的场景，所以需要重新全部选中
    for (let i = Math.min(this.firstSelectedBlockIndex, targetIndex); i <= Math.max(this.firstSelectedBlockIndex, targetIndex); i++) {
      BlockManager.blocks[i].selected = true;
    }

    this.endSelectedBlockIndex = targetIndex;
    // /**
    //  * If first and last block have the different selection state
    //  * it means we should't toggle selection of the first selected block.
    //  * In the other case we shouldn't toggle the last selected block.
    //  */
    // const shouldntSelectFirstBlock = firstBlock.selected !== lastBlock.selected;
    //
    // for (let i = Math.min(fIndex, lIndex); i <= Math.max(fIndex, lIndex); i++) {
    //   const block = BlockManager.blocks[i];
    //
    //   if (
    //     block !== this.firstSelectedBlock &&
    //     block !== (shouldntSelectFirstBlock ? firstBlock : lastBlock)
    //   ) {
    //     // BlockManager.blocks[i].selected = !BlockManager.blocks[i].selected;
    //     BlockManager.blocks[i].selected = true;
    //
    //     BlockSelection.clearCache();
    //   }
    // }
  }
}
