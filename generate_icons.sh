#!/bin/bash

# 图标生成脚本
# 从 icon.png 生成 icon.ico 和 icon.icns

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 打印带颜色的信息
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查命令是否存在
check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "$1 未安装或不在PATH中"
        return 1
    fi
    return 0
}

# 检查文件是否存在
check_file() {
    if [ ! -f "$1" ]; then
        print_error "文件不存在: $1"
        return 1
    fi
    return 0
}

# 主函数
main() {
    local source_icon="icons/icon.png"
    local ico_output="icons/icon.ico"
    local icns_output="icons/icon.icns"
    local iconset_dir="icons/icon.iconset"

    print_info "开始图标生成过程..."

    # 检查源文件
    if ! check_file "$source_icon"; then
        exit 1
    fi

    print_info "源文件: $source_icon"

    # 检查依赖
    print_info "检查依赖工具..."
    
    # 对于 ico 文件，我们需要 ImageMagick
    if ! check_command "convert"; then
        print_error "ImageMagick 未安装"
        print_info "请使用以下命令安装: brew install imagemagick"
        exit 1
    fi

    # 对于 icns 文件，我们需要 iconutil (macOS 内置)
    if ! check_command "iconutil"; then
        print_error "iconutil 未找到 (需要 macOS)"
        exit 1
    fi

    # 生成 .ico 文件
    print_info "生成 $ico_output..."
    convert "$source_icon" \
        \( -clone 0 -resize 16x16 \) \
        \( -clone 0 -resize 32x32 \) \
        \( -clone 0 -resize 48x48 \) \
        \( -clone 0 -resize 64x64 \) \
        \( -clone 0 -resize 128x128 \) \
        \( -clone 0 -resize 256x256 \) \
        -delete 0 "$ico_output"
    
    if [ $? -eq 0 ]; then
        print_info "✓ 成功生成 $ico_output"
    else
        print_error "✗ 生成 $ico_output 失败"
        exit 1
    fi

    # 生成 iconset 目录和各种尺寸的 PNG 文件
    print_info "生成 iconset 文件..."
    
    # 创建 iconset 目录
    mkdir -p "$iconset_dir"

    # 定义需要的尺寸
    declare -a icon_files=(
        "icon_16x16.png"
        "icon_16x16@2x.png"
        "icon_32x32.png"
        "icon_32x32@2x.png"
        "icon_128x128.png"
        "icon_128x128@2x.png"
        "icon_256x256.png"
        "icon_256x256@2x.png"
        "icon_512x512.png"
        "icon_512x512@2x.png"
    )
    
    declare -a icon_sizes=(
        "16x16"
        "32x32"
        "32x32"
        "64x64"
        "128x128"
        "256x256"
        "256x256"
        "512x512"
        "512x512"
        "1024x1024"
    )

    # 生成各种尺寸的图标
    for i in "${!icon_files[@]}"; do
        filename="${icon_files[$i]}"
        size="${icon_sizes[$i]}"
        output_path="$iconset_dir/$filename"
        
        print_info "生成 $filename ($size)..."
        convert "$source_icon" -resize "$size" "$output_path"
        
        if [ $? -ne 0 ]; then
            print_error "生成 $filename 失败"
            exit 1
        fi
    done

    # 使用 iconutil 生成 .icns 文件
    print_info "生成 $icns_output..."
    iconutil -c icns "$iconset_dir" -o "$icns_output"
    
    if [ $? -eq 0 ]; then
        print_info "✓ 成功生成 $icns_output"
    else
        print_error "✗ 生成 $icns_output 失败"
        exit 1
    fi

    # 显示生成的文件信息
    print_info "生成完成！文件信息:"
    echo ""
    ls -la "$ico_output" "$icns_output"
    echo ""
    print_info "iconset 目录内容:"
    ls -la "$iconset_dir/"

    print_info "🎉 所有图标文件生成完成!"
}

# 显示帮助信息
show_help() {
    echo "图标生成脚本"
    echo ""
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  -h, --help    显示此帮助信息"
    echo ""
    echo "功能:"
    echo "  从 icons/icon.png 生成 icons/icon.ico 和 icons/icon.icns"
    echo ""
    echo "依赖:"
    echo "  - ImageMagick (brew install imagemagick)"
    echo "  - iconutil (macOS 内置)"
    echo ""
    echo "示例:"
    echo "  $0              # 生成图标文件"
    echo "  $0 --help       # 显示帮助"
}

# 解析命令行参数
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    "")
        main
        ;;
    *)
        print_error "未知选项: $1"
        print_info "使用 --help 查看帮助信息"
        exit 1
        ;;
esac
