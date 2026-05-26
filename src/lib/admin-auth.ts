/**
 * 管理员认证工具
 * 使用 HMAC 签名验证，无状态，不依赖内存存储
 */

import { createHmac, timingSafeEqual } from 'crypto';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '210527';

// 使用 ADMIN_PASSWORD 派生签名密钥，避免硬编码
function getSecret(): string {
  return createHmac('sha256', 'ai-pulse-admin').update(ADMIN_PASSWORD).digest('hex');
}

const TOKEN_EXPIRY = 24 * 60 * 60 * 1000; // 24小时

/**
 * 创建管理员 session token
 * 格式: base64(timestamp-hmac_signature)
 */
export function createAdminSession(): string {
  const timestamp = Date.now();
  const secret = getSecret();
  const signature = createHmac('sha256', secret).update(`${timestamp}`).digest('hex');
  const payload = `${timestamp}-${signature}`;
  return Buffer.from(payload).toString('base64');
}

/**
 * 验证管理员 token
 */
export function verifyAdminToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    const separatorIndex = decoded.lastIndexOf('-');
    if (separatorIndex === -1) return false;

    const timestamp = parseInt(decoded.substring(0, separatorIndex), 10);
    const signature = decoded.substring(separatorIndex + 1);

    // 检查过期
    if (isNaN(timestamp) || Date.now() - timestamp > TOKEN_EXPIRY) {
      return false;
    }

    // 验证签名
    const secret = getSecret();
    const expectedSignature = createHmac('sha256', secret).update(`${timestamp}`).digest('hex');

    // 时序安全比较，防止时序攻击
    if (signature.length !== expectedSignature.length) return false;
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
  } catch {
    return false;
  }
}

/**
 * 验证管理员密码
 */
export function verifyAdminPassword(password: string): boolean {
  return password === ADMIN_PASSWORD;
}

/**
 * 撤销 token（无状态方案下，只需前端删除 cookie 即可，此函数保留兼容）
 */
export function revokeAdminToken(_token: string): void {
  // 无状态方案不需要服务端撤销，cookie 删除即可
}
