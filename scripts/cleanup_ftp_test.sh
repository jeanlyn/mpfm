#!/bin/bash

# FTP测试环境清理脚本

set -e

echo "正在清理FTP测试环境..."

# 停止并删除FTP测试服务器
if docker ps | grep -q ftp-test-server; then
    echo "停止FTP测试服务器..."
    docker stop ftp-test-server
    echo "✅ FTP测试服务器已停止"
else
    echo "ℹ️  FTP测试服务器未在运行"
fi

# 清理可能存在的悬挂容器
docker ps -a | grep ftp-test-server | awk '{print $1}' | xargs -r docker rm

echo "✅ FTP测试环境清理完成"
