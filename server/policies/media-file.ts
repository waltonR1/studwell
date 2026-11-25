// 检查上传媒体的文件内容与格式约束，不负责文件持久化。
import {MEDIA_MAX_BYTES,VIDEO_MAX_BYTES} from '#shared/config/admin/media'
import { ApiError } from '../core/errors';
import {isMp4Video} from './mp4'
import {inspectIco} from './ico'

function acceptedMime(declared: string, detected: string) {
    const value = declared.trim().toLowerCase()
    if (!value || value === 'application/octet-stream') return true
    if (detected === 'image/jpeg') return ['image/jpeg', 'image/jpg', 'image/pjpeg'].includes(value)
    if (detected === 'image/vnd.microsoft.icon') return ['image/vnd.microsoft.icon', 'image/x-icon'].includes(value)
    return value === detected
}

// 部分相册和修图软件会在 IEND 后附加厂商元数据；结构完整即可，不要求文件刚好在那里结束。
function hasPngEnd(bytes: Buffer) {
    let offset = 8, hasImageData = false
    while (offset + 12 <= bytes.length) {
        const length = bytes.readUInt32BE(offset), type = bytes.toString('ascii', offset + 4, offset + 8)
        if (length > bytes.length - offset - 12) return false
        if (type === 'IDAT') hasImageData = true
        if (type === 'IEND') return hasImageData && length === 0
        offset += length + 12
    }
    return false
}

// 手机相册常在 EOI 后附加编辑参数；只确认扫描数据后面确实有结束标记。
function hasJpegEnd(bytes: Buffer) {
    let offset = 2, scanStart = -1
    while (offset + 1 < bytes.length) {
        if (bytes[offset] !== 255) return false
        let markerOffset = offset + 1
        while (bytes[markerOffset] === 255) markerOffset++
        if (markerOffset >= bytes.length) return false
        const marker = bytes[markerOffset]!
        if (marker === 218) {
            scanStart = markerOffset + 1
            break
        }
        if (marker === 217) return false
        offset = markerOffset + 1
        if (marker === 0 || marker === 1 || marker >= 208 && marker <= 216) continue
        if (offset + 2 > bytes.length) return false
        const length = bytes.readUInt16BE(offset)
        if (length < 2 || offset + length > bytes.length) return false
        offset += length
    }
    if (scanStart < 0) return false
    for (let index = scanStart; index + 1 < bytes.length; index++) {
        if (bytes[index] === 255 && bytes[index + 1] === 217) return true
    }
    return false
}

// 按真实文件结构读取尺寸，不信任浏览器MIME或文件扩展名。
export function inspectMediaFile(bytes: Buffer, filename: string, declared: string) {
    if (!bytes.length || bytes.length > (declared === 'video/mp4' ? VIDEO_MAX_BYTES : MEDIA_MAX_BYTES))
        throw new ApiError('REQUEST_TOO_LARGE');
    let mime = '', extension = '', width: number | null = null, height: number | null = null;
    if (bytes.length >= 45 && bytes.readUInt32BE(8) === 13 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && bytes.toString('ascii', 12, 16) === 'IHDR') {
        mime = 'image/png';
        extension = 'png';
        width = bytes.readUInt32BE(16);
        height = bytes.readUInt32BE(20);
        if (!hasPngEnd(bytes))
            mime = '';
    }
    else if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') {
        mime = 'image/webp';
        extension = 'webp';
        if (bytes.readUInt32LE(4) + 8 > bytes.length)
            mime = '';
        const format = bytes.toString('ascii', 12, 16);
        if (format === 'VP8X' && bytes.length >= 30) {
            width = bytes.readUIntLE(24, 3) + 1;
            height = bytes.readUIntLE(27, 3) + 1;
        }
        else if (format === 'VP8 ' && bytes.length >= 30 && bytes.subarray(23, 26).equals(Buffer.from([157, 1, 42]))) {
            width = bytes.readUInt16LE(26) & 16383;
            height = bytes.readUInt16LE(28) & 16383;
        }
        else if (format === 'VP8L' && bytes.length >= 25 && bytes[20] === 47) {
            const bits = bytes.readUInt32LE(21);
            width = (bits & 16383) + 1;
            height = ((bits >>> 14) & 16383) + 1;
        }
    }
    else if (bytes.length > 4 && bytes[0] === 255 && bytes[1] === 216) {
        mime = 'image/jpeg';
        extension = 'jpg';
        if (!hasJpegEnd(bytes))
            mime = '';
        let offset = 2;
        while (offset + 4 <= bytes.length) {
            if (bytes[offset] !== 255)
                break;
            const marker = bytes[offset + 1]!;
            offset += 2;
            if (marker === 217 || marker === 218)
                break;
            if (marker === 255) {
                offset--;
                continue;
            }
            if (marker === 216 || marker === 1 || marker >= 208 && marker <= 215)
                continue;
            const length = bytes.readUInt16BE(offset);
            if (length < 2 || offset + length > bytes.length)
                break;
            if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker) && length >= 8) {
                height = bytes.readUInt16BE(offset + 3);
                width = bytes.readUInt16BE(offset + 5);
                break;
            }
            offset += length;
        }
    }
    else if (bytes.length >= 6 && bytes.readUInt16LE(0) === 0 && bytes.readUInt16LE(2) === 1) {
        const dimensions=inspectIco(bytes)
        if(dimensions){mime='image/vnd.microsoft.icon';extension='ico';width=dimensions.width;height=dimensions.height}
    }
    else if (declared === 'video/mp4' && isMp4Video(bytes)) {mime='video/mp4';extension='mp4'}
    const suffix = filename.split('.').pop()?.toLowerCase();
    if (!mime || !acceptedMime(declared, mime) || !(extension === 'jpg' ? ['jpg', 'jpeg'] : [extension]).includes(suffix ?? ''))
        throw new ApiError('INVALID_INPUT', [{ path: 'file', message: '仅支持格式匹配的 JPEG、PNG、WebP、ICO 图片和MP4视频文件。' }]);
    if (mime.startsWith('image/') && (!width || !height || width > 20000 || height > 20000 || width * height > 40000000))
        throw new ApiError('INVALID_INPUT', [{ path: 'file', message: '图片尺寸无效，最长边20000像素，总像素不超过4000万。' }]);
    return { mime, kind: mime === 'video/mp4' ? 'video' as const : 'image' as const, width, height, size: bytes.length };
}
