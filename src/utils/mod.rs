// 公开实际使用的函数，不再导出未使用的函数
pub mod format {
    
    

    /// 格式化文件大小显示
    pub fn format_size(size: u64) -> String {
        const KB: u64 = 1024;
        const MB: u64 = KB * 1024;
        const GB: u64 = MB * 1024;
        const TB: u64 = GB * 1024;

        if size < KB {
            format!("{} B", size)
        } else if size < MB {
            format!("{:.2} KB", size as f64 / KB as f64)
        } else if size < GB {
            format!("{:.2} MB", size as f64 / MB as f64)
        } else if size < TB {
            format!("{:.2} GB", size as f64 / GB as f64)
        } else {
            format!("{:.2} TB", size as f64 / TB as f64)
        }
    }
}
