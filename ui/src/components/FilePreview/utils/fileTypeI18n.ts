import { FileType } from './fileTypeDetector';

/**
 * 获取国际化的文件类型显示名称
 * @param fileType 文件类型
 * @param fileTypes 国际化的文件类型翻译对象
 * @returns 文件类型的显示名称
 */
export function getLocalizedFileTypeDisplayName(
  fileType: FileType, 
  fileTypes: {
    text: string;
    json: string;
    code: string;
    image: string;
    pdf: string;
    excel: string;
    word: string;
    unknown: string;
  }
): string {
  switch (fileType) {
    case 'text': return fileTypes.text;
    case 'json': return fileTypes.json;
    case 'code': return fileTypes.code;
    case 'image': return fileTypes.image;
    case 'pdf': return fileTypes.pdf;
    case 'excel': return fileTypes.excel;
    case 'word': return fileTypes.word;
    default: return fileTypes.unknown;
  }
}
