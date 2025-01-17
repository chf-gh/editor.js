import {BlockToolData} from '../tools';
import { BlockId } from './block-id';

/**
 * Tool's saved data
 */
export interface SavedData {
  id: BlockId;
  tool: string;
  data: BlockToolData;
  time: number;
}

/**
 * 复制时的数据
 */
export interface CopyData {
  textPlain: string;
  textHtml: string;
}

/**
 * Tool's data after validation
 */
export interface ValidatedData {
  id?: BlockId;
  tool?: string;
  data?: BlockToolData;
  time?: number;
  isValid: boolean;
}
