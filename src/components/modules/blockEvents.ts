/**
 * Contains keyboard and mouse events bound on each Block by Block Manager
 */
import Module from '../__module';
import * as _ from '../utils';
import SelectionUtils from '../selection';
import Flipper from '../flipper';
import type Block from '../block';
import { areBlocksMergeable } from '../utils/blocks';
import * as caretUtils from '../utils/caret';
import { focus } from '@editorjs/caret';

/**
 *
 */
export default class BlockEvents extends Module {
  /**
   * All keydowns on Block
   *
   * @param {KeyboardEvent} event - keydown
   */
  public keydown(event: KeyboardEvent): void {
    /**
     * Run common method for all keydown events
     */
    this.beforeKeydownProcessing(event);

    /**
     * Fire keydown processor by event.keyCode
     */
    switch (event.keyCode) {
      case _.keyCodes.BACKSPACE:
        this.backspace(event);
        break;

      case _.keyCodes.DELETE:
        this.delete(event);
        break;

      case _.keyCodes.ENTER:
        this.enter(event);
        break;

      case _.keyCodes.DOWN:
      case _.keyCodes.RIGHT:
        this.arrowRightAndDown(event);
        break;

      case _.keyCodes.UP:
      case _.keyCodes.LEFT:
        this.arrowLeftAndUp(event);
        break;

      case _.keyCodes.TAB:
        this.tabPressed(event);
        break;
    }

    /**
     * We check for "key" here since on different keyboard layouts "/" can be typed as "Shift + 7" etc
     *
     * @todo probably using "beforeInput" event would be better here
     */
    if (event.key === '/' && !event.ctrlKey && !event.metaKey) {
      this.slashPressed(event);
    }

    /**
     * If user pressed "Ctrl + /" or "Cmd + /" — open Block Settings
     * We check for "code" here since on different keyboard layouts there can be different keys in place of Slash.
     */
    if (event.code === 'Slash' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      this.commandSlashPressed();
    }
  }

  /**
   * Fires on keydown before event processing
   *
   * @param {KeyboardEvent} event - keydown
   */
  public beforeKeydownProcessing(event: KeyboardEvent): void {
    /**
     * Do not close Toolbox on Tabs or on Enter with opened Toolbox
     */
    if (!this.needToolbarClosing(event)) {
      return;
    }

    /**
     * When user type something:
     *  - close Toolbar
     *  - clear block highlighting
     */
    if (_.isPrintableKey(event.keyCode)) {
      this.Editor.Toolbar.close();

      /**
       * Allow to use shortcuts with selected blocks
       *
       * @type {boolean}
       */
      const isShortcut = event.ctrlKey || event.metaKey || event.altKey || event.shiftKey;

      if (!isShortcut) {
        this.Editor.BlockSelection.clearSelection(event);
      }
    }
  }

  /**
   * Key up on Block:
   * - shows Inline Toolbar if something selected
   * - shows conversion toolbar with 85% of block selection
   *
   * @param {KeyboardEvent} event - keyup event
   */
  public keyup(event: KeyboardEvent): void {
    /**
     * If shift key was pressed some special shortcut is used (eg. cross block selection via shift + arrows)
     */
    if (event.shiftKey) {
      return;
    }

    /**
     * Check if editor is empty on each keyup and add special css class to wrapper
     */
    this.Editor.UI.checkEmptiness();
  }

  /**
   * Add drop target styles
   *
   * @param {DragEvent} event - drag over event
   */
  public dragOver(event: DragEvent): void {
    const block = this.Editor.BlockManager.getBlockByChildNode(event.target as Node);

    block.dropTarget = true;
  }

  /**
   * Remove drop target style
   *
   * @param {DragEvent} event - drag leave event
   */
  public dragLeave(event: DragEvent): void {
    const block = this.Editor.BlockManager.getBlockByChildNode(event.target as Node);

    block.dropTarget = false;
  }

  /**
   * Copying selected blocks
   * Before putting to the clipboard we sanitize all blocks and then copy to the clipboard
   *
   * @param {ClipboardEvent} event - clipboard event
   */
  public handleCommandC(event: ClipboardEvent): void {
    const { BlockSelection } = this.Editor;

    if (!BlockSelection.anyBlockSelected) {
      return;
    }

    // Copy Selected Blocks
    BlockSelection.copySelectedBlocks(event);
  }

  /**
   * Copy and Delete selected Blocks
   *
   * @param {ClipboardEvent} event - clipboard event
   */
  public handleCommandX(event: ClipboardEvent): void {
    const { BlockSelection, BlockManager, Caret } = this.Editor;

    if (!BlockSelection.anyBlockSelected) {
      return;
    }

    BlockSelection.copySelectedBlocks(event).then(() => {
      const selectionPositionIndex = BlockManager.removeSelectedBlocks();

      /**
       * Insert default block in place of removed ones
       */
      const insertedBlock = BlockManager.insertDefaultBlockAtIndex(selectionPositionIndex, true);

      Caret.setToBlock(insertedBlock, Caret.positions.START);

      /** Clear selection */
      BlockSelection.clearSelection(event);
    });
  }

  /**
   * Tab pressed inside a Block.
   *
   * @param {KeyboardEvent} event - keydown
   */
  private tabPressed(event: KeyboardEvent): void {
    const { InlineToolbar, Caret } = this.Editor;

    const isFlipperActivated = InlineToolbar.opened;

    if (isFlipperActivated) {
      return;
    }

    const isNavigated = event.shiftKey ? Caret.navigatePrevious(true) : Caret.navigateNext(true);

    /**
     * If we have next Block/input to focus, then focus it. Otherwise, leave native Tab behaviour
     */
    if (isNavigated) {
      event.preventDefault();
    }
  }

  /**
   * '/' + 'command' keydown inside a Block
   */
  private commandSlashPressed(): void {
    if (this.Editor.BlockSelection.selectedBlocks.length > 1) {
      return;
    }

    this.activateBlockSettings();
  }

  /**
   * '/' keydown inside a Block
   *
   * @param event - keydown
   */
  private slashPressed(event: KeyboardEvent): void {
    const wasEventTriggeredInsideEditor = this.Editor.UI.nodes.wrapper.contains(event.target as Node);

    if (!wasEventTriggeredInsideEditor) {
      return;
    }

    const currentBlock = this.Editor.BlockManager.currentBlock;
    const canOpenToolbox = currentBlock.isEmpty;

    /**
     * @todo Handle case when slash pressed when several blocks are selected
     */

    /**
     * Toolbox will be opened only if Block is empty
     */
    if (!canOpenToolbox) {
      return;
    }

    /**
     * The Toolbox will be opened with immediate focus on the Search input,
     * and '/' will be added in the search input by default — we need to prevent it and add '/' manually
     */
    event.preventDefault();
    this.Editor.Caret.insertContentAtCaretPosition('/');

    this.activateToolbox();
  }

  /**
   * ENTER pressed on block
   *
   * @param {KeyboardEvent} event - keydown
   */
  private enter(event: KeyboardEvent): void {
    const { BlockManager, UI } = this.Editor;
    const currentBlock = BlockManager.currentBlock;

    if (currentBlock === undefined) {
      return;
    }

    /**
     * Don't handle Enter keydowns when Tool sets enableLineBreaks to true.
     * Uses for Tools like <code> where line breaks should be handled by default behaviour.
     */
    if (currentBlock.tool.isLineBreaksEnabled) {
      return;
    }

    /**
     * Opened Toolbars uses Flipper with own Enter handling
     * Allow split block when no one button in Flipper is focused
     */
    if (UI.someToolbarOpened && UI.someFlipperButtonFocused) {
      return;
    }

    /**
     * Allow to create line breaks by Shift+Enter
     *
     * Note. On iOS devices, Safari automatically treats enter after a period+space (". |") as Shift+Enter
     * (it used for capitalizing of the first letter of the next sentence)
     * We don't need to lead soft line break in this case — new block should be created
     */
    if (event.shiftKey && !_.isIosDevice) {
      return;
    }

    let blockToFocus = currentBlock;

    /**
     * If enter has been pressed at the start of the text, just insert paragraph Block above
     */
    if (currentBlock.currentInput !== undefined && caretUtils.isCaretAtStartOfInput(currentBlock.currentInput) && !currentBlock.hasMedia) {
      this.Editor.BlockManager.insertDefaultBlockAtIndex(this.Editor.BlockManager.currentBlockIndex);

    /**
     * If caret is at very end of the block, just append the new block without splitting
     * to prevent unnecessary dom mutation observing
     */
    } else if (currentBlock.currentInput && caretUtils.isCaretAtEndOfInput(currentBlock.currentInput)) {
      blockToFocus = this.Editor.BlockManager.insertDefaultBlockAtIndex(this.Editor.BlockManager.currentBlockIndex + 1);
    } else {
      /**
       * Split the Current Block into two blocks
       * Renew local current node after split
       */
      blockToFocus = this.Editor.BlockManager.split();
    }

    this.Editor.Caret.setToBlock(blockToFocus);

    /**
     * Show Toolbar
     */
    this.Editor.Toolbar.moveAndOpen(blockToFocus);

    event.preventDefault();
  }

  /**
   * Handle backspace keydown on Block
   *
   * @param {KeyboardEvent} event - keydown
   */
  private backspace(event: KeyboardEvent): void {
    const { BlockManager, Caret } = this.Editor;
    const { currentBlock, previousBlock } = BlockManager;

    if (currentBlock === undefined) {
      return;
    }

    /**
     * If some fragment is selected, leave native behaviour
     */
    if (!SelectionUtils.isCollapsed) {
      return;
    }

    /**
     * If caret is not at the start, leave native behaviour
     */
    if (!currentBlock.currentInput || !caretUtils.isCaretAtStartOfInput(currentBlock.currentInput)) {
      return;
    }
    /**
     * All the cases below have custom behaviour, so we don't need a native one
     */
    event.preventDefault();
    this.Editor.Toolbar.close();

    const isFirstInputFocused = currentBlock.currentInput === currentBlock.firstInput;

    /**
     * For example, caret at the start of the Quote second input (caption) — just navigate previous input
     */
    if (!isFirstInputFocused) {
      Caret.navigatePrevious();

      return;
    }

    /**
     * Backspace at the start of the first Block should do nothing
     */
    if (previousBlock === null) {
      return;
    }

    /**
     * If prev Block is empty, it should be removed just like a character
     */
    if (previousBlock.isEmpty) {
      BlockManager.removeBlock(previousBlock);

      return;
    }

    /**
     * If current Block is empty, just remove it and set cursor to the previous Block (like we're removing line break char)
     */
    if (currentBlock.isEmpty) {
      BlockManager.removeBlock(currentBlock);

      const newCurrentBlock = BlockManager.currentBlock;

      Caret.setToBlock(newCurrentBlock, Caret.positions.END);

      return;
    }

    const bothBlocksMergeable = areBlocksMergeable(previousBlock, currentBlock);

    /**
     * If Blocks could be merged, do it
     * Otherwise, just navigate previous block
     */
    if (bothBlocksMergeable) {
      this.mergeBlocks(previousBlock, currentBlock);
    } else {
      Caret.setToBlock(previousBlock, Caret.positions.END);
    }
  }

  /**
   * Handles delete keydown on Block
   * Removes char after the caret.
   * If caret is at the end of the block, merge next block with current
   *
   * @param {KeyboardEvent} event - keydown
   */
  private delete(event: KeyboardEvent): void {
    const { BlockManager, Caret } = this.Editor;
    const { currentBlock, nextBlock } = BlockManager;

    /**
     * If some fragment is selected, leave native behaviour
     */
    if (!SelectionUtils.isCollapsed) {
      return;
    }

    /**
     * If caret is not at the end, leave native behaviour
     */
    if (!caretUtils.isCaretAtEndOfInput(currentBlock.currentInput)) {
      return;
    }

    /**
     * All the cases below have custom behaviour, so we don't need a native one
     */
    event.preventDefault();
    this.Editor.Toolbar.close();

    const isLastInputFocused = currentBlock.currentInput === currentBlock.lastInput;

    /**
     * For example, caret at the end of the Quote first input (quote text) — just navigate next input (caption)
     */
    if (!isLastInputFocused) {
      Caret.navigateNext();

      return;
    }

    /**
     * Delete at the end of the last Block should do nothing
     */
    if (nextBlock === null) {
      return;
    }

    /**
     * If next Block is empty, it should be removed just like a character
     */
    if (nextBlock.isEmpty) {
      BlockManager.removeBlock(nextBlock);

      return;
    }

    /**
     * If current Block is empty, just remove it and set cursor to the next Block (like we're removing line break char)
     */
    if (currentBlock.isEmpty) {
      BlockManager.removeBlock(currentBlock);

      Caret.setToBlock(nextBlock, Caret.positions.START);

      return;
    }

    const bothBlocksMergeable = areBlocksMergeable(currentBlock, nextBlock);

    /**
     * If Blocks could be merged, do it
     * Otherwise, just navigate to the next block
     */
    if (bothBlocksMergeable) {
      this.mergeBlocks(currentBlock, nextBlock);
    } else {
      Caret.setToBlock(nextBlock, Caret.positions.START);
    }
  }

  /**
   * Merge passed Blocks
   *
   * @param targetBlock - to which Block we want to merge
   * @param blockToMerge - what Block we want to merge
   */
  private mergeBlocks(targetBlock: Block, blockToMerge: Block): void {
    const { BlockManager, Toolbar } = this.Editor;

    if (targetBlock.lastInput === undefined) {
      return;
    }

    focus(targetBlock.lastInput, false);

    BlockManager
      .mergeBlocks(targetBlock, blockToMerge)
      .then(() => {
        Toolbar.close();
      });
  }

  /**
   * Handle right and down keyboard keys
   *
   * @param {KeyboardEvent} event - keyboard event
   */
  private arrowRightAndDown(event: KeyboardEvent): void {
    const isFlipperCombination = Flipper.usedKeys.includes(event.keyCode) &&
      (!event.shiftKey || event.keyCode === _.keyCodes.TAB);

    /**
     * Arrows might be handled on toolbars by flipper
     * Check for Flipper.usedKeys to allow navigate by DOWN and disallow by RIGHT
     */
    if (this.Editor.UI.someToolbarOpened && isFlipperCombination) {
      return;
    }

    /**
     * Close Toolbar when user moves cursor
     */
    this.Editor.Toolbar.close();

    const { currentBlock } = this.Editor.BlockManager;
    const caretAtEnd = currentBlock?.currentInput !== undefined ? caretUtils.isCaretAtEndOfInput(currentBlock.currentInput) : undefined;
    const shouldEnableCBS = caretAtEnd || this.Editor.BlockSelection.anyBlockSelected;

    if (event.shiftKey && event.keyCode === _.keyCodes.DOWN && shouldEnableCBS) {
      this.Editor.CrossBlockSelection.toggleBlockSelectedState();

      return;
    }

    const navigateNext = event.keyCode === _.keyCodes.DOWN || (event.keyCode === _.keyCodes.RIGHT && !this.isRtl);
    const isNavigated = navigateNext ? this.Editor.Caret.navigateNext() : this.Editor.Caret.navigatePrevious();

    if (isNavigated) {
      /**
       * Default behaviour moves cursor by 1 character, we need to prevent it
       */
      event.preventDefault();

      return;
    }

    /**
     * After caret is set, update Block input index
     */
    _.delay(() => {
      /** Check currentBlock for case when user moves selection out of Editor */
      if (this.Editor.BlockManager.currentBlock) {
        this.Editor.BlockManager.currentBlock.updateCurrentInput();
      }
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    }, 20)();

    /**
     * Clear blocks selection by arrows
     */
    this.Editor.BlockSelection.clearSelection(event);
  }

  /**
   * Handle left and up keyboard keys
   *
   * @param {KeyboardEvent} event - keyboard event
   */
  private arrowLeftAndUp(event: KeyboardEvent): void {
    /**
     * Arrows might be handled on toolbars by flipper
     * Check for Flipper.usedKeys to allow navigate by UP and disallow by LEFT
     */
    if (this.Editor.UI.someToolbarOpened) {
      if (Flipper.usedKeys.includes(event.keyCode) && (!event.shiftKey || event.keyCode === _.keyCodes.TAB)) {
        return;
      }

      this.Editor.UI.closeAllToolbars();
    }

    /**
     * Close Toolbar when user moves cursor
     */
    this.Editor.Toolbar.close();

    const { currentBlock } = this.Editor.BlockManager;
    const caretAtStart = currentBlock?.currentInput !== undefined ? caretUtils.isCaretAtStartOfInput(currentBlock.currentInput) : undefined;
    const shouldEnableCBS = caretAtStart || this.Editor.BlockSelection.anyBlockSelected;

    if (event.shiftKey && event.keyCode === _.keyCodes.UP && shouldEnableCBS) {
      this.Editor.CrossBlockSelection.toggleBlockSelectedState(false);

      return;
    }

    const navigatePrevious = event.keyCode === _.keyCodes.UP || (event.keyCode === _.keyCodes.LEFT && !this.isRtl);
    const isNavigated = navigatePrevious ? this.Editor.Caret.navigatePrevious() : this.Editor.Caret.navigateNext();

    if (isNavigated) {
      /**
       * Default behaviour moves cursor by 1 character, we need to prevent it
       */
      event.preventDefault();

      return;
    }

    /**
     * After caret is set, update Block input index
     */
    _.delay(() => {
      /** Check currentBlock for case when user ends selection out of Editor and then press arrow-key */
      if (this.Editor.BlockManager.currentBlock) {
        this.Editor.BlockManager.currentBlock.updateCurrentInput();
      }
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    }, 20)();

    /**
     * Clear blocks selection by arrows
     */
    this.Editor.BlockSelection.clearSelection(event);
  }

  /**
   * Cases when we need to close Toolbar
   *
   * @param {KeyboardEvent} event - keyboard event
   */
  private needToolbarClosing(event: KeyboardEvent): boolean {
    const toolboxItemSelected = (event.keyCode === _.keyCodes.ENTER && this.Editor.Toolbar.toolbox.opened),
        blockSettingsItemSelected = (event.keyCode === _.keyCodes.ENTER && this.Editor.BlockSettings.opened),
        inlineToolbarItemSelected = (event.keyCode === _.keyCodes.ENTER && this.Editor.InlineToolbar.opened),
        flippingToolbarItems = event.keyCode === _.keyCodes.TAB;

    /**
     * Do not close Toolbar in cases:
     * 1. ShiftKey pressed (or combination with shiftKey)
     * 2. When Toolbar is opened and Tab leafs its Tools
     * 3. When Toolbar's component is opened and some its item selected
     */
    return !(event.shiftKey ||
      flippingToolbarItems ||
      toolboxItemSelected ||
      blockSettingsItemSelected ||
      inlineToolbarItemSelected
    );
  }

  /**
   * If Toolbox is not open, then just open it and show plus button
   */
  private activateToolbox(): void {
    if (!this.Editor.Toolbar.opened) {
      this.Editor.Toolbar.moveAndOpen();
    } // else Flipper will leaf through it

    this.Editor.Toolbar.toolbox.open();
  }

  /**
   * Open Toolbar and show BlockSettings before flipping Tools
   */
  private activateBlockSettings(): void {
    if (!this.Editor.Toolbar.opened) {
      this.Editor.Toolbar.moveAndOpen();
    }

    /**
     * If BlockSettings is not open, then open BlockSettings
     * Next Tab press will leaf Settings Buttons
     */
    if (!this.Editor.BlockSettings.opened) {
      /**
       * @todo Debug the case when we set caret to some block, hovering another block
       *       — wrong settings will be opened.
       *       To fix it, we should refactor the Block Settings module — make it a standalone class, like the Toolbox
       */
      this.Editor.BlockSettings.open();
    }
  }
}
