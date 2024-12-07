import {BlockToolData, BlockToolMergeData} from '../tools';

/**
 * Config allows Tool to specify how it can be converted into/from another Tool
 */
export interface ConversionConfig {
  /**
   * How to import string to this Tool.
   *
   * Function: — 导入其他块数据转换为自身块数据结构
   */
  import?: ((data: BlockToolMergeData) => BlockToolMergeData);

  /**
   * How to export this Tool to make other Block.
   *
   * Can be a String or Function:
   *
   * 1. String — which property of saved Tool data should be used as exported string.
   * 2. Function — accepts saved Tool data and create a string to export
   */
  export?: ((data: BlockToolData) => BlockToolMergeData);
}
