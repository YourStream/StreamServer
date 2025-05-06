import { logger } from "@yourstream/core/index.js";
import { serviceAuthGuard } from "@yourstream/core/serviceAuthVerifier.js";
import { Router } from "express";
import { exec } from 'child_process';
import util from 'util';

const router = Router();
const execPromise = util.promisify(exec);

const RTMP_SERVER = `rtmp://${process.env.RTMP_SERVER}/live`;
if (!process.env.RTMP_SERVER) {
    logger.error('[ERROR] Missing RTMP_SERVER environment variable');
    process.exit(1);
}

const QUALITY_TABLE = {
    '144p': '256:144',
    '360p': '640:360',
    '480p': '854:480',
    '720p': '1280:720',
    '1080p': '1920:1080',
};

router.post('/start', serviceAuthGuard, async (req, res) => {
    const { userId, source, destination, destinationQuality } = req.body;
    if (!userId || !source || !destination || !destinationQuality) {
        logger.trace(`[REJECT] Missing parameters: userId: ${userId}, source: ${source}, destination: ${destination}, destinationQuality: ${destinationQuality}`);
        res.status(400).send('Missing parameters');
        return;
    }

    const inputUrl = `${RTMP_SERVER}/${source}`;
    const outputUrl = `${RTMP_SERVER}/${destination}`;
    const scale = QUALITY_TABLE[destinationQuality as keyof typeof QUALITY_TABLE];
    if (!scale) {
        logger.trace(`[REJECT] Invalid quality: ${destinationQuality}`);
        res.status(400).send('Invalid quality');
        return;
    }
    const ffmpegCommand = `ffmpeg -i ${inputUrl} -c:v libx264 -preset veryfast -crf 28 -c:a aac -b:a 96k -vf scale=${scale} -f flv ${outputUrl}`;
    // wait for the stream to be available
    const streamReady = await waitForStream(inputUrl);
    if (!streamReady) {
        logger.error(`[ERROR] Stream not ready: ${inputUrl}`);
        res.status(500).send('Stream not ready');
        return;
    }
    logger.info(`[START] Starting transcoding from ${inputUrl} to ${outputUrl}`);
    try {
        exec(ffmpegCommand, (error) => {
            if (error) {
                logger.error(`[ERROR] Failed to start transcoding: ${error}`);
                return;
            }
            logger.info(`[SUCCESS] Transcoding started from ${inputUrl} to ${outputUrl}`);
        });
        logger.info(`[SUCCESS] Transcoding started from ${inputUrl} to ${outputUrl}`);
        res.status(200).send('Transcoding started');
    }
    catch (error) {
        logger.error(`[ERROR] Failed to start transcoding: ${error}`);
        res.status(500).send('Failed to start transcoding');
    }
});

router.post('/restream', serviceAuthGuard, async (req, res) => {
    const { userId, source, destination } = req.body;
    if (!userId || !source || !destination) {
        logger.trace(`[REJECT] Missing parameters: userId: ${userId}, source: ${source}, destination: ${destination}`);
        res.status(400).send('Missing parameters');
        return;
    }
    const inputUrl = `${RTMP_SERVER}/${source}`;
    const outputUrl = `${RTMP_SERVER}/${destination}`;

    const ffmpegCommand = `ffmpeg -i ${inputUrl} -c:v copy -c:a copy -f flv ${outputUrl}`;

    // wait for the stream to be available
    const streamReady = await waitForStream(inputUrl);
    if (!streamReady) {
        logger.error(`[ERROR] Stream not ready: ${inputUrl}`);
        res.status(500).send('Stream not ready');
        return;
    }
    logger.info(`[START] Starting restream from ${inputUrl} to ${outputUrl}`);
    try {
        exec(ffmpegCommand, (error) => {
            if (error) {
                logger.error(`[ERROR] Failed to start restream: ${error}`);
                return;
            }
            logger.info(`[SUCCESS] Restream started from ${inputUrl} to ${outputUrl}`);
        });
        logger.info(`[SUCCESS] Restream started from ${inputUrl} to ${outputUrl}`);
        res.status(200).send('Restream started');
    } catch (error) {
        logger.error(`[ERROR] Failed to start restream: ${error}`);
        res.status(500).send('Failed to start restream');
    }
});

async function waitForStream(rtmpUrl: string, retries = 10, delayMs = 1000): Promise<boolean> {
    for (let i = 0; i < retries; i++) {
        try {
            await execPromise(`ffprobe -v error -i ${rtmpUrl}`);
            return true;
        } catch {
            logger.debug(`[WAITING] ${rtmpUrl} not ready (${i + 1}/${retries})`);
            await new Promise((r) => setTimeout(r, delayMs));
        }
    }
    return false;
}


export default router;
