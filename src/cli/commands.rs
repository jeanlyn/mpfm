use clap::{Arg, ArgAction, ArgGroup, Command};

/// 构建命令行界面
pub fn build_cli() -> Command {
    Command::new("mpfm")
        .about("多协议文件管理器")
        .version(env!("CARGO_PKG_VERSION"))
        .subcommand_required(true)
        .arg_required_else_help(true)
        .subcommand(
            Command::new("connection")
                .about("管理连接配置")
                .subcommand_required(true)
                .subcommand(Command::new("list").about("列出所有连接"))
                .subcommand(
                    Command::new("show")
                        .about("显示连接详情")
                        .arg(Arg::new("id").help("连接 ID").required(true))
                )
                .subcommand(
                    Command::new("add")
                        .about("添加新连接")
                        .arg(Arg::new("name").short('n').long("name").help("连接名称").required(true))
                        .arg(Arg::new("type").short('t').long("type").help("协议类型 (s3, fs 等)").required(true))
                        .arg(Arg::new("config").short('c').long("config").help("连接配置 (JSON 格式)").required(true))
                )
                .subcommand(
                    Command::new("remove")
                        .about("删除连接")
                        .arg(Arg::new("id").help("连接 ID").required(true))
                )
        )
        .subcommand(
            Command::new("ls")
                .about("列出文件和目录")
                .arg(Arg::new("connection").short('c').long("connection").help("连接 ID").required(true))
                .arg(Arg::new("path").help("远程路径").default_value("/"))
        )
        .subcommand(
            Command::new("upload")
                .about("上传文件")
                .arg(Arg::new("connection").short('c').long("connection").help("连接 ID").required(true))
                .arg(Arg::new("local_path").help("本地文件路径").required(true))
                .arg(Arg::new("remote_path").help("远程文件路径").required(true))
        )
        .subcommand(
            Command::new("download")
                .about("下载文件")
                .arg(
                    Arg::new("connection")
                        .short('c')
                        .long("connection")
                        .help("连接 ID")
                        .conflicts_with_all(["type", "config"]),
                )
                .arg(
                    Arg::new("type")
                        .short('t')
                        .long("type")
                        .help("协议类型 (s3, fs, ftp 等)")
                        .requires("config")
                        .conflicts_with("connection"),
                )
                .arg(
                    Arg::new("config")
                        .long("config")
                        .help("连接配置 (JSON 格式)")
                        .requires("type")
                        .conflicts_with("connection"),
                )
                .group(
                    ArgGroup::new("download_source")
                        .args(["connection", "type"])
                        .required(true),
                )
                .arg(Arg::new("remote_path").help("远程文件路径").required(true))
                .arg(Arg::new("local_path").help("本地文件路径").required(true))
        )
        .subcommand(
            Command::new("rm")
                .about("删除文件或目录")
                .arg(Arg::new("connection").short('c').long("connection").help("连接 ID").required(true))
                .arg(Arg::new("path").help("远程路径").required(true))
                .arg(
                    Arg::new("recursive")
                        .short('r')
                        .long("recursive")
                        .help("递归删除目录")
                        .action(ArgAction::SetTrue)
                )
        )
        .subcommand(
            Command::new("mkdir")
                .about("创建目录")
                .arg(Arg::new("connection").short('c').long("connection").help("连接 ID").required(true))
                .arg(Arg::new("path").help("远程路径").required(true))
        )
        .subcommand(
            Command::new("stat")
                .about("获取文件或目录信息")
                .arg(Arg::new("connection").short('c').long("connection").help("连接 ID").required(true))
                .arg(Arg::new("path").help("远程路径").required(true))
        )
}

#[cfg(test)]
mod tests {
    use clap::error::ErrorKind;

    use super::build_cli;

    #[test]
    fn download_accepts_inline_protocol_config_arguments() {
        let matches = build_cli().try_get_matches_from([
            "mpfm",
            "download",
            "--type",
            "ftp",
            "--config",
            r#"{"host":"ftp.example.com","port":"21","username":"demo","password":"secret"}"#,
            "/packages/app.tar.gz",
            "./app.tar.gz",
        ]);

        assert!(matches.is_ok());

        let matches = matches.unwrap();
        let download = matches.subcommand_matches("download").unwrap();

        assert_eq!(
            download.get_one::<String>("type").map(String::as_str),
            Some("ftp")
        );
        assert_eq!(
            download.get_one::<String>("config").map(String::as_str),
            Some(r#"{"host":"ftp.example.com","port":"21","username":"demo","password":"secret"}"#)
        );
    }

    #[test]
    fn download_requires_connection_or_inline_protocol_config() {
        let error = build_cli()
            .try_get_matches_from(["mpfm", "download", "/packages/app.tar.gz", "./app.tar.gz"])
            .unwrap_err();

        assert_eq!(error.kind(), ErrorKind::MissingRequiredArgument);
    }
}
