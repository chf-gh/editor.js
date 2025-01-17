import {OutputData} from '../data-formats/output-data';
import {CopyData} from '../data-formats';

/**
 * Describes Editor`s saver API
 */
export interface Saver {
  /**
   * Saves Editors data and returns promise with it
   *
   * @returns {Promise<OutputData>}
   */
  save(): Promise<OutputData>;
  copySave(): Promise<CopyData[]>;
}
