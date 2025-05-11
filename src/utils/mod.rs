pub mod logger;

// 公开实际使用的函数，不再导出未使用的函数
pub mod format {
    use chrono::{DateTime, Utc};
    use opendal::EntryMode;

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

    /// 格式化修改时间显示
    pub fn format_time(time: Option<DateTime<Utc>>) -> String {
        if let Some(time) = time {
            time.format("%Y-%m-%d %H:%M:%S").to_string()
        } else {
            "未知".to_string()
        }
    }

    /// 格式化文件类型
    pub fn format_mode(mode: EntryMode) -> String {
        match mode {
            EntryMode::FILE => "文件".to_string(),
            EntryMode::DIR => "目录".to_string(),
            _ => "未知".to_string(),
        }
    }
}