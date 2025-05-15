import { logger } from "@yourstream/core/index.js";
import { buildServiceRequest } from "@yourstream/core/serviceAuthVerifier.js";

const STREAM_API_HOST = process.env.STREAM_API_HOST as string;
if (!STREAM_API_HOST) {
    throw new Error('STREAM_API_HOST is not set');
}

async function getStreamKey(id: string) {
    logger.trace(`[REQUESTED][getStreamKey] ${id}`);
    const request = await buildServiceRequest(STREAM_API_HOST, `/api/user/origen?id=${id}`,{
        method: 'GET',
    });
    if (!request.ok) {
        logger.trace(`[REJECT][getStreamKey] ${request.statusText}`);
        throw new Error(`Failed to fetch stream key: ${request.statusText}`);
    }
    const streamKey = await request.text();
    if (!streamKey) {
        logger.trace(`[REJECT][getStreamKey] Stream key not found`);
        throw new Error('Stream key not found');
    }
    logger.trace(`[REQUESTED][getStreamKey] ${streamKey}`);
    return streamKey;
}

async function getStreamQuality(id: string) {
    const request = await buildServiceRequest(STREAM_API_HOST, `/api/user/quality?id=${id}`,{
        method: 'GET',
    });
    if (!request.ok) {
        throw new Error(`Failed to fetch stream quality: ${request.statusText}`);
    }
    const qualities = await request.json();
    if (!qualities) {
        throw new Error('Stream quality not found');
    }
    return qualities as {
        status: string;
        isSource: boolean;
        quality: string;
        rtmp: string;
        url: string;
    }[];
}

export { getStreamKey, getStreamQuality };