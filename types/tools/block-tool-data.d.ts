/**
 * Object returned by Tool's {@link BlockTool#save} method
 * Specified by Tool developer, so leave it as object
 */
export type BlockToolData<T extends object = any> = T;

type TextStyle = 'B' | 'i' | '<>' | 'U' | 'S' | 'Link' | 'Mark' | 'Color';

type TextStyleDetail =
  | [TextStyle] // 单一样式（如加粗、斜体、代码等）
  | [TextStyle, string]; // 特殊样式需要附带额外信息（如 Link 的 href 链接）

export type TextData = [string] | [string, TextStyleDetail[]];
/**
 * block合并时的数据格式
 */
export type BlockToolMergeData = {
  text: TextData[],
  indent?: number
};
