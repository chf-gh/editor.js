import Module from '../__module';
import Block from '../block';
import SelectionUtils from '../selection';
import * as _ from '../utils';
import $ from '../dom';

/**
 *
 */
export default class CrossBlockSelection extends Module {
  /**
   * Block where selection is started
   */
  private firstSelectedBlock: Block;
  // 第一个选中的block的下标
  private firstSelectedBlockIndex: number;

  /**
   * Last selected Block
   */
  private lastSelectedBlock: Block;
  // 最后一个选中的block的下标
  private endSelectedBlockIndex: number;

  /**
   * Module preparation
   *
   * @returns {Promise}
   */
  public async prepare(): Promise<void> {
    this.listeners.on(document, 'mousedown', (event: MouseEvent) => {
      this.enableCrossBlockSelection(event);
    });
    // 清除选中区域，禁止拖动文字
    this.removeSelectionForbiddenDrag();
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
    this.Editor.BlockSelection.clearSelection(event);

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

    this.toggleBlocksSelectedState(targetBlock);
    this.lastSelectedBlock = targetBlock;
  };

  /**
   * Change blocks selection state between passed two blocks.
   *
   * @param {Block} targetBlock - 当前block
   */
  private toggleBlocksSelectedState(targetBlock: Block): void {
    const { BlockManager } = this.Editor;
    const targetIndex = BlockManager.blocks.indexOf(targetBlock);

    // 不在新区域内的block全部取消选中
    const newBeginIndex = Math.min(targetIndex, this.firstSelectedBlockIndex);
    const newEndIndex = Math.max(targetIndex, this.firstSelectedBlockIndex);
    for (let i = Math.min(this.firstSelectedBlockIndex, this.endSelectedBlockIndex); i <= Math.max(this.firstSelectedBlockIndex, this.endSelectedBlockIndex); i++) {
      if (i < newBeginIndex || i > newEndIndex) {
        BlockManager.blocks[i].selected = false;
      }
    }

    // 区域内所有选中-》考虑子级block的场景，所以需要重新全部选中
    for (let i = Math.min(this.firstSelectedBlockIndex, targetIndex); i <= Math.max(this.firstSelectedBlockIndex, targetIndex); i++) {
      BlockManager.blocks[i].selected = true;
    }
    // 保存最后的下标
    this.endSelectedBlockIndex = targetIndex;
  }

  /**
   * 清除选中区域，禁止拖动文字
   * @private
   */
  private removeSelectionForbiddenDrag(): void {
    const { UI } = this.Editor;

    this.listeners.on(UI.nodes.holder, 'mousedown', async (event: MouseEvent) => {
      if (event.target && event.target.closest) {
        const toolbar = event.target.closest(`.${this.Editor.InlineToolbar.CSS.inlineToolbar}`);
        // 如果操作了内联按钮则选区不消失
        if (toolbar) {
          return;
        }
      }
      // 禁止选中文本进行拖动
      if (window.getSelection) {
        const selection = window.getSelection();

        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          if ($.isNativeInput(document.activeElement)) {
            // textarea|input
            document.activeElement.selectionStart = document.activeElement.selectionEnd; // 取消选区
          } else if (range && !range.collapsed) {
            // 普通的dom
            selection.removeAllRanges();
          }
        }
      }
    }, true);
  }
}
