// 适配媒体的 HTTP 请求、输入校验及响应，业务规则交给服务层。
import {moduleImageRules} from '../../services/website-image-rules'
import {MEDIA_MAX_BYTES,VIDEO_MAX_BYTES} from '#shared/config/admin/media'
import {parseMediaRange} from '../media-range'
import { getHeader, getQuery, send, setResponseStatus, setResponseHeader } from 'h3';
import { z } from 'zod';
import type { Database } from '../../db/transaction';
import type { MediaStorage } from '../../core/media-storage';
import { createMediaService } from '../../services/media';
import { createAuthService } from '../../services/auth';
import { defineApiHandler, apiErrorResponse } from '../handler';
import { authMeta, requestActor, type AuthHttpOptions } from '../auth';
import { parseJsonBody, parseParams, readLimitedBody } from '../validation';
import { entityIdSchema, entityVersionSchema } from '#shared/schemas/entity';
import { mediaMetadataSchema, mediaUpdateSchema } from '#shared/schemas/admin/media';
import { parseInput } from '../../core/validation';
import { requirePermission } from '../../services/access/permissions';
export function mediaHandlers(database: Database, options: AuthHttpOptions, storage: MediaStorage) {
    const service = createMediaService(database, storage), auth = createAuthService(database);
    const actor = (event: Parameters<typeof requestActor>[0]) => requestActor(event, auth);
    const key = async (event: Parameters<typeof getHeader>[0]) => (await parseParams(event, z.strictObject({ id: entityIdSchema }))).id;
    return {
        imageRules: defineApiHandler(async event=>moduleImageRules(database,await actor(event))),
        list: defineApiHandler(async (event) => service.list(await actor(event), getQuery(event))),
        upload: defineApiHandler(async (event) => {
            const user = await actor(event);
            await requirePermission(database, user, 'content.media.create');
            const filename = await parseInput(z.string().min(1).max(255), getQuery(event).filename);
            const metadata = mediaMetadataSchema.parse({ name: filename.slice(0, 160), remark: '' });
            return service.upload(user, metadata, { bytes: await readLimitedBody(event, getHeader(event, 'content-type')?.split(';')[0] === 'video/mp4' ? VIDEO_MAX_BYTES : MEDIA_MAX_BYTES), filename, mime: getHeader(event, 'content-type')?.split(';')[0] ?? '' }, authMeta(event, options));
        }),
        update: defineApiHandler(async (event) => service.update(await actor(event), await key(event), await parseJsonBody(event, mediaUpdateSchema), authMeta(event, options))),
        remove: defineApiHandler(async (event) => service.remove(await actor(event), await key(event), (await parseJsonBody(event, z.strictObject({ version: entityVersionSchema }))).version, authMeta(event, options))),
        async file(event: Parameters<typeof getHeader>[0], publicFile = false) {
            try {
                const range = parseMediaRange(getHeader(event,'range'));
                const result = publicFile ? await service.publicFile((await parseParams(event,z.strictObject({filename:z.string().max(80)}))).filename,range) : await service.file(await key(event), await actor(event), range);
                if(result.unsatisfied){setResponseStatus(event,416);setResponseHeader(event,'Content-Range',`bytes */${result.size}`);return send(event,'')}
                if(result.kind==='video')setResponseHeader(event,'Accept-Ranges','bytes')
                if(result.start!==undefined){setResponseStatus(event,206);setResponseHeader(event,'Content-Range',`bytes ${result.start}-${result.end}/${result.size}`)}
                setResponseHeader(event,'Content-Length',result.bytes.length)
                setResponseHeader(event, 'Content-Type', result.mime);
                setResponseHeader(event, 'X-Content-Type-Options', 'nosniff');
                setResponseHeader(event, 'Cache-Control', 'no-store');
                setResponseHeader(event, 'Content-Security-Policy', "default-src 'none'; sandbox");
                setResponseHeader(event, 'Content-Disposition', 'inline');
                return send(event, result.bytes);
            }
            catch (error) {
                return apiErrorResponse(event, error);
            }
        },
    };
}
