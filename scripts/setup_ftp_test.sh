#!/bin/bash

# FTP测试环境设置脚本
# 此脚本用于设置FTP服务器用于集成测试

set -e

echo "正在设置FTP测试环境..."

# 检查Docker是否可用
if ! command -v docker &> /dev/null; then
    echo "错误: 需要安装Docker来运行FTP测试服务器"
    exit 1
fi

# 检测CPU架构并选择合适的Docker镜像
ARCH=$(uname -m)
case $ARCH in
    x86_64)
        FTP_IMAGE="delfer/alpine-ftp-server"
        echo "检测到x86_64架构，使用镜像: $FTP_IMAGE"
        ;;
    arm64|aarch64)
        FTP_IMAGE="delfer/alpine-ftp-server"
        echo "检测到ARM64架构，使用镜像: $FTP_IMAGE"
        ;;
    *)
        echo "错误: 不支持的CPU架构: $ARCH"
        echo "支持的架构: x86_64, arm64/aarch64"
        exit 1
        ;;
esac

ADDRESS="127.0.0.1"
if [[ "$OSTYPE" == "darwin"* ]]; then
  ADDRESS=$(ipconfig getifaddr en0)
else
  ADDRESS=$(hostname -I)
fi

# 启动FTP测试服务器
echo "启动FTP测试服务器 (端口 2121)..."
docker run --rm -d \
    --name ftp-test-server \
    -p 2121:21 \
    -p 21000-21010:21000-21010 \
    -e USERS="testuser|testpass|/ftp|10000" \
    -e ADDRESS=${ADDRESS} \
    $FTP_IMAGE

# 等待服务器启动
echo "等待FTP服务器启动..."
sleep 5

# 检查服务器是否正在运行
if docker ps | grep -q ftp-test-server; then
    echo "✅ FTP测试服务器已启动"
    echo "   主机: 127.0.0.1"
    echo "   端口: 2121" 
    echo "   用户名: testuser"
    echo "   密码: testpass"
    echo ""
    echo "现在可以运行FTP集成测试:"
    echo "cargo test ftp_integration_tests"
    echo ""
    echo "要停止测试服务器，请运行:"
    echo "docker stop ftp-test-server"
else
    echo "❌ FTP测试服务器启动失败"
    exit 1
fi
