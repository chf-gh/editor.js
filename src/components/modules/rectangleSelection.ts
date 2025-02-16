/**
 * @class RectangleSelection
 * @classdesc Manages Block selection with mouse
 * @module RectangleSelection
 * @version 1.0.0
 */
import Module from '../__module';
import $ from '../dom';

import SelectionUtils from '../selection';
import Block from '../block';
import * as _ from '../utils';
import {EditorConfig} from "../../../types";
import {ModuleConfig} from "../../types-internal/module-config";

/**
 *
 */
export default class RectangleSelection extends Module {
  // 指定rectangle的容器
  private container: HTMLElement | undefined;
  private enable: boolean;
  private editorVisible: () => boolean;

  /**
   * CSS classes for the Block
   *
   * @returns {{wrapper: string, content: string}}
   */
  public static get CSS(): {[name: string]: string} {
    return {
      overlay: 'codex-editor-overlay',
      overlayContainer: 'codex-editor-overlay__container',
      rect: 'codex-editor-overlay__rectangle',
      topScrollZone: 'codex-editor-overlay__scroll-zone--top',
      bottomScrollZone: 'codex-editor-overlay__scroll-zone--bottom',
    };
  }

  /**
   * Using the selection rectangle
   *
   * @type {boolean}
   */
  private isRectSelectionActivated = false;

  /**
   *  Speed of Scrolling
   */
  private readonly SCROLL_SPEED: number = 3;

  /**
   *  Height of scroll zone on boundary of screen
   */
  private readonly HEIGHT_OF_SCROLL_ZONE = 100;

  /**
   * 移动速度因子
   * @private
   */
  private speedFactory = 1;
  /**
   * 移动速度
   * @private
   */
  private speed = 4;
  /**
   * Id of main button for event.button
   */
  private readonly MAIN_MOUSE_BUTTON = 0;

  /**
   *  Mouse is clamped
   */
  private mousedown = false;


  /**
   *  Mouse is in scroll zone
   */
  private inScrollZone: boolean = false;

  /**
   *  Coords of rect
   */
  private startX = 0;
  private startY = 0;
  private mouseX = 0;
  private mouseY = 0;

  /**
   * Selected blocks
   */
  private stackOfSelected: number[] = [];

  /**
   * Does the rectangle intersect blocks
   */
  private rectCrossesBlocks: boolean;

  /**
   * Selection rectangle
   */
  private overlayRectangle: HTMLDivElement;

  /**
   * Listener identifiers
   */
  private listenerIds: string[] = [];

  // 滚动的容器
  private scrollContainer: HTMLElement;
  /**
   * Module Preparation
   * Creating rect and hang handlers
   */
  public prepare(): void {
    const { rectangleSelection, scrollHolder, holder } = this.config;

    this.scrollContainer = $.getHolder(scrollHolder) || $.getHolder(holder);
    if (!rectangleSelection) {
      return;
    }
    const containerHolder = rectangleSelection?.containerHolder;
    if (containerHolder) {
      this.container = document.getElementById(containerHolder) || undefined;
    }
    this.enable = rectangleSelection?.enable || false;
    if (rectangleSelection.editorVisible && _.isFunction(rectangleSelection.editorVisible)) {
      this.editorVisible = rectangleSelection.editorVisible;
    } else {
      this.editorVisible = () => {
        return true;
      };
    }
    if (!this.enable || !this.container){
      return;
    }
    this.enableModuleBindings();
  }

  /**
   * Init rect params
   *
   * @param {number} pageX - X coord of mouse
   * @param {number} pageY - Y coord of mouse
   */
  public startSelection(event: MouseEvent): void {
    const elemWhereSelectionStart = document.elementFromPoint(event.pageX - window.scrollX,  event.pageY - window.scrollY);

    /**
     * Don't clear selected block by clicks on the Block settings
     * because we need to keep highlighting working block
     */
    const startsInsideToolbar = elemWhereSelectionStart.closest(`.${this.Editor.Toolbar.CSS.toolbar}`);

    if (!startsInsideToolbar) {
      this.Editor.BlockSelection.allBlocksSelected = false;
      this.clearSelection();
      this.stackOfSelected = [];
    }

    const selectorsToAvoid = [
      `.${Block.CSS.content}`,
      `.${this.Editor.Toolbar.CSS.toolbar}`,
      `.${this.Editor.InlineToolbar.CSS.inlineToolbar}`,
    ];

    // const startsInsideEditor = elemWhereSelectionStart.closest('.' + this.Editor.UI.CSS.editorWrapper);
    const startsInSelectorToAvoid = selectorsToAvoid.some((selector) => !!elemWhereSelectionStart.closest(selector));

    /**
     * If selection starts outside of the editor or inside the blocks or on Editor UI elements, do not handle it
     */
    // if (!startsInsideEditor || startsInSelectorToAvoid) {
    //   return;
    // }
    if (startsInSelectorToAvoid) {
      return;
    }

    // 根据显示器的分辨率（宽度）进行调整，保证滚动速度一致
    this.speedFactory = window.innerHeight / 768; // 假设窗口高度768为标准

    this.mousedown = true;
    this.startX = event.pageX + this.scrollContainer.scrollLeft;
    this.startY = event.pageY + this.scrollContainer.scrollTop;
  }

  /**
   * Clear all params to end selection
   */
  public endSelection(): void {
    this.speedFactory = 1;
    this.mousedown = false;
    this.startX = 0;
    this.startY = 0;
    this.overlayRectangle.style.display = 'none';
  }

  /**
   * is RectSelection Activated
   */
  public isRectActivated(): boolean {
    return this.isRectSelectionActivated;
  }

  /**
   * Mark that selection is end
   */
  public clearSelection(): void {
    this.isRectSelectionActivated = false;
  }

  /**
   * Sets Module necessary event handlers
   */
  private enableModuleBindings(): void {
    const { container } = this.genHTML();

    this.listeners.on(container, 'mousedown', (mouseEvent: MouseEvent) => {
      // 编辑器可见时才处理
      if (this.editorVisible()) {
        this.processMouseDown(mouseEvent);
      }
    }, false);

    this.listeners.on(document.body, 'mousemove', _.throttle((mouseEvent: MouseEvent) => {
      this.processMouseMove(mouseEvent);
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    }, 10), {
      passive: true,
    });

    this.listeners.on(document.body, 'mouseleave', () => {
      this.processMouseLeave();
    });

    this.listeners.on(window, 'scroll', _.throttle((mouseEvent: MouseEvent) => {
      this.processScroll(mouseEvent);
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    }, 10), {
      passive: true,
    });

    this.listeners.on(document.body, 'mouseup', () => {
      this.processMouseUp();
    }, false);
  }

  /**
   * Handle mouse down events
   *
   * @param {MouseEvent} mouseEvent - mouse event payload
   */
  private processMouseDown(mouseEvent: MouseEvent): void {
    if (mouseEvent.button !== this.MAIN_MOUSE_BUTTON) {
      return;
    }

    /**
     * Do not enable the Rectangle Selection when mouse dragging started some editable input
     * Used to prevent Rectangle Selection on Block Tune wrappers' inputs that also can be inside the Block
     */
    const startedFromContentEditable = (mouseEvent.target as Element).closest($.allInputsSelector) !== null;

    if (!startedFromContentEditable) {
      this.startSelection(mouseEvent);
    }
  }

  /**
   * Handle mouse move events
   *
   * @param {MouseEvent} mouseEvent - mouse event payload
   */
  private processMouseMove(mouseEvent: MouseEvent): void {
    this.changingRectangle(mouseEvent);
    this.scrollByZones(mouseEvent);
  }

  /**
   * Handle mouse leave
   */
  private processMouseLeave(): void {
    this.clearSelection();
    this.endSelection();
  }

  /**
   * @param {MouseEvent} mouseEvent - mouse event payload
   */
  private processScroll(mouseEvent: MouseEvent): void {
    this.changingRectangle(mouseEvent);
  }

  /**
   * Handle mouse up
   */
  private processMouseUp(): void {
    this.clearSelection();
    this.endSelection();
  }

  /**
   * Scroll If mouse in scroll zone
   *
   * @param {number} clientY - Y coord of mouse
   */
  private scrollByZones(mouseEvent: MouseEvent): void {
    this.inScrollZone = false;
    const distanceFromTop = mouseEvent.clientY;  // 距离页面顶部的距离
    const distanceFromBottom = window.innerHeight - mouseEvent.clientY;  // 距离页面底部的距离

    let deltaY = 0;  // 初始垂直移动值

    // 如果鼠标距离顶部小于 100px，则向上滚动
    if (distanceFromTop < this.HEIGHT_OF_SCROLL_ZONE) {
      deltaY = -(this.HEIGHT_OF_SCROLL_ZONE - distanceFromTop);  // 根据距离顶部的距离计算滚动速度
      this.inScrollZone = true;
    }
    // 如果鼠标距离底部小于 200px，则向下滚动
    else if (distanceFromBottom < this.HEIGHT_OF_SCROLL_ZONE) {
      deltaY = (this.HEIGHT_OF_SCROLL_ZONE - distanceFromBottom);  // 根据距离底部的距离计算滚动速度
      this.inScrollZone = true;
    }

    if (!this.inScrollZone) {
      return;
    }

    this.scrollVertical((deltaY/this.HEIGHT_OF_SCROLL_ZONE)*this.speed* this.speedFactory);
  }

  /**
   * Generates required HTML elements
   *
   * @returns {Object<string, Element>}
   */
  private genHTML(): {container: Element; overlay: Element} {
    // const { UI } = this.Editor;
    // const container = UI.nodes.holder.querySelector('.' + UI.CSS.editorWrapper);

    const container= this.container;

    const overlay = $.make('div', RectangleSelection.CSS.overlay, {});
    const overlayContainer = $.make('div', RectangleSelection.CSS.overlayContainer, {});
    const overlayRectangle = $.make('div', RectangleSelection.CSS.rect, {});

    overlayContainer.appendChild(overlayRectangle);
    overlay.appendChild(overlayContainer);
    container.appendChild(overlay);

    this.overlayRectangle = overlayRectangle as HTMLDivElement;

    return {
      container,
      overlay,
    };
  }

  /**
   * Activates scrolling if blockSelection is active and mouse is in scroll zone
   *
   * @param {number} speed - speed of scrolling
   */
  private scrollVertical(speed): void {
    console.log('speed==',speed);
    if (!(this.inScrollZone && this.mousedown)) {
      return;
    }

    this.scrollContainer.scrollBy(0, speed);
    setTimeout(() => {
      this.scrollVertical(speed);
    }, 0);
  }

  /**
   * Handles the change in the rectangle and its effect
   *
   * @param {MouseEvent} event - mouse event
   */
  private changingRectangle(event: MouseEvent): void {
    if (!this.mousedown) {
      return;
    }

    this.mouseX = event.pageX || 0;
    this.mouseY = event.pageY || 0;

    const { rightPos, leftPos, index } = this.genInfoForMouseSelection();
    // There is not new block in selection

    const rectIsOnRighSideOfredactor = this.startX > rightPos && this.mouseX > rightPos;
    const rectISOnLeftSideOfRedactor = this.startX < leftPos && this.mouseX < leftPos;

    this.rectCrossesBlocks = !(rectIsOnRighSideOfredactor || rectISOnLeftSideOfRedactor);

    if (!this.isRectSelectionActivated) {
      this.rectCrossesBlocks = false;
      this.isRectSelectionActivated = true;
      this.shrinkRectangleToPoint();
      this.overlayRectangle.style.display = 'block';
    }

    this.updateRectangleSize();

    /**
     * Hide Block Settings Toggler (along with the Toolbar) (if showed) when the Rectangle Selection is activated
     */
    this.Editor.Toolbar.close();

    if (index === undefined) {
      return;
    }

    this.trySelectNextBlock(index);
    // For case, when rect is out from blocks
    this.inverseSelection();

    SelectionUtils.get().removeAllRanges();
  }

  /**
   * Shrink rect to singular point
   */
  private shrinkRectangleToPoint(): void {
    this.overlayRectangle.style.left = `${this.startX - this.scrollContainer.scrollLeft - window.scrollX}px`;
    this.overlayRectangle.style.top = `${this.startY - this.scrollContainer.scrollTop - window.scrollY}px`;
    this.overlayRectangle.style.bottom = `calc(100% - ${this.startY - this.scrollContainer.scrollTop - window.scrollY}px)`;
    this.overlayRectangle.style.right = `calc(100% - ${this.startX - this.scrollContainer.scrollLeft - window.scrollX}px)`;
  }

  /**
   * Select or unselect all of blocks in array if rect is out or in selectable area
   */
  private inverseSelection(): void {
    const firstBlockInStack = this.Editor.BlockManager.getBlockByIndex(this.stackOfSelected[0]);
    const isSelectedMode = firstBlockInStack?.selected || false;

    if (this.rectCrossesBlocks && !isSelectedMode) {
      for (const it of this.stackOfSelected) {
        this.Editor.BlockSelection.selectBlockByIndex(it);
      }
    }

    if (!this.rectCrossesBlocks && isSelectedMode) {
      for (const it of this.stackOfSelected) {
        this.Editor.BlockSelection.unSelectBlockByIndex(it);
      }
    }
  }
  /**
   * Updates size of rectangle
   */
  private updateRectangleSize(): void {
    // 向下选择还是向上选择
    if (this.mouseY + this.scrollContainer.scrollTop >= this.startY) {
      // 如果window有scroll需要单独减掉
      this.overlayRectangle.style.top = `${this.startY - this.scrollContainer.scrollTop - window.scrollY}px`;
      this.overlayRectangle.style.bottom = `-${this.mouseY - window.scrollY}px`;
    } else {
      this.overlayRectangle.style.bottom = `-${this.startY - this.scrollContainer.scrollTop - window.scrollY}px`;
      // 如果window有scroll需要单独减掉
      this.overlayRectangle.style.top = `${this.mouseY - window.scrollY}px`;
    }

    if (this.mouseX >= this.startX) {
      this.overlayRectangle.style.left = `${this.startX - this.scrollContainer.scrollLeft - window.scrollX}px`;
      this.overlayRectangle.style.right = `calc(100% - ${this.mouseX - this.scrollContainer.scrollLeft - window.scrollX}px`;
    } else {
      this.overlayRectangle.style.right = `calc(100% - ${this.startX - this.scrollContainer.scrollLeft - window.scrollX}px`;
      this.overlayRectangle.style.left = `${this.mouseX - this.scrollContainer.scrollLeft - window.scrollX}px`;
    }
  }

  /**
   * Collects information needed to determine the behavior of the rectangle
   *
   * @returns {object} index - index next Block, leftPos - start of left border of Block, rightPos - right border
   */
  private genInfoForMouseSelection(): {index: number; leftPos: number; rightPos: number} {
    // const widthOfRedactor = document.body.offsetWidth;
    const widthOfRedactor = this.scrollContainer.offsetWidth;
    const centerOfRedactor = widthOfRedactor / 2;
    const Y = this.mouseY - window.scrollY;
    const elementUnderMouse = document.elementFromPoint(centerOfRedactor, Y);
    const blockInCurrentPos = this.Editor.BlockManager.getBlockByChildNode(elementUnderMouse);
    let index;

    if (blockInCurrentPos !== undefined) {
      index = this.Editor.BlockManager.blocks.findIndex((block) => block.holder === blockInCurrentPos.holder);
    }
    console.log('index==',index);
    const contentElement = this.Editor.BlockManager.lastBlock.holder.querySelector('.' + Block.CSS.content);
    const centerOfBlock = Number.parseInt(window.getComputedStyle(contentElement).width, 10) / 2;
    const leftPos = centerOfRedactor - centerOfBlock;
    const rightPos = centerOfRedactor + centerOfBlock;

    return {
      index,
      leftPos,
      rightPos,
    };
  }

  /**
   * Select block with index index
   *
   * @param index - index of block in redactor
   */
  private addBlockInSelection(index): void {
    if (this.rectCrossesBlocks) {
      this.Editor.BlockSelection.selectBlockByIndex(index);
    }
    this.stackOfSelected.push(index);
  }

  /**
   * Adds a block to the selection and determines which blocks should be selected
   *
   * @param {object} index - index of new block in the reactor
   */
  private trySelectNextBlock(index): void {
    const sameBlock = this.stackOfSelected[this.stackOfSelected.length - 1] === index;
    const sizeStack = this.stackOfSelected.length;
    const down = 1, up = -1, undef = 0;

    if (sameBlock) {
      return;
    }

    const blockNumbersIncrease = this.stackOfSelected[sizeStack - 1] - this.stackOfSelected[sizeStack - 2] > 0;

    let direction = undef;

    if (sizeStack > 1) {
      direction = blockNumbersIncrease ? down : up;
    }

    const selectionInDownDirection = index > this.stackOfSelected[sizeStack - 1] && direction === down;
    const selectionInUpDirection = index < this.stackOfSelected[sizeStack - 1] && direction === up;
    const generalSelection = selectionInDownDirection || selectionInUpDirection || direction === undef;
    const reduction = !generalSelection;

    // When the selection is too fast, some blocks do not have time to be noticed. Fix it.
    if (!reduction && (index > this.stackOfSelected[sizeStack - 1] ||
      this.stackOfSelected[sizeStack - 1] === undefined)) {
      let ind = this.stackOfSelected[sizeStack - 1] + 1 || index;

      for (ind; ind <= index; ind++) {
        this.addBlockInSelection(ind);
      }

      return;
    }

    // for both directions
    if (!reduction && (index < this.stackOfSelected[sizeStack - 1])) {
      for (let ind = this.stackOfSelected[sizeStack - 1] - 1; ind >= index; ind--) {
        this.addBlockInSelection(ind);
      }

      return;
    }

    if (!reduction) {
      return;
    }

    let i = sizeStack - 1;
    let cmp;

    // cmp for different directions
    if (index > this.stackOfSelected[sizeStack - 1]) {
      cmp = (): boolean => index > this.stackOfSelected[i];
    } else {
      cmp = (): boolean => index < this.stackOfSelected[i];
    }

    // Remove blocks missed due to speed.
    // cmp checks if we have removed all the necessary blocks
    while (cmp()) {
      if (this.rectCrossesBlocks) {
        this.Editor.BlockSelection.unSelectBlockByIndex(this.stackOfSelected[i]);
      }
      this.stackOfSelected.pop();
      i--;
    }
  }
}
