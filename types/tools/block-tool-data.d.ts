/**
 * Object returned by Tool's {@link BlockTool#save} method
 * Specified by Tool developer, so leave it as object
 */
export type BlockToolData<T extends object = any> = T;

/**
 * block合并时的数据格式
 */
export type BlockToolMergeData = {
  text: string,
  indent?: number
};
