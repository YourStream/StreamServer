import { Router } from "express";
import { StreamModel } from "../models/StreamModel";
import { logger } from "@yourstream/core/index.js";
import { buildServiceRequest } from "@yourstream/core/serviceAuthVerifier.js";

const router = Router();

const TRANSCODER_SERVICE_ADDRESS = process.env.TRANSCODER_SERVICE_ADDRESS as string;
if (!TRANSCODER_SERVICE_ADDRESS) {
    logger.error('[ERROR] Missing environment variable: TRANSCODER_SERVICE_ADDRESS');
    process.exit(1);
}

router.post('/on_publish', async (req, res) => {
    const name = req.body.name as string;
    if (!name) {
        logger.debug(`[REJECT] Invalid stream key: ${name}`);
        res.status(403).end();
        return;
    }
    // name is: userId-key or userId-key_quality
    const [userId, key] = name.split('-');
    const isMainStream = key.split('_').length === 1;
    const quality = isMainStream ? null : key.split('_')[1];

    logger.trace(`[STREAM] ${name} isMainStream: "${isMainStream}" quality: "${quality}"`);

    const stream = await StreamModel.findOne({ userId: userId });
    if (!stream) {
        logger.debug(`[REJECT] Invalid stream key: ${name}. User not found`);
        logger.trace(`[REJECT] UserId: "${userId}" key: "${key}" isMainStream: "${isMainStream}" quality: "${quality}"`);
        res.status(403).end();
        return;
    }

    if (isMainStream && stream.streamKey !== key) {
        logger.debug(`[REJECT] Invalid stream key: ${name}`);
        res.status(403).end();
        return;
    }

    if (stream.isLive && isMainStream) {
        logger.debug(`[REJECT] Stream already live: ${name}_source`);
        res.status(403).end();
        return;
    }

    if (!isMainStream && stream.qualities.some((q) => q.quality === quality && q.status === 'live')) {
        logger.debug(`[REJECT] Stream already live: ${name}_${quality}`);
        res.status(403).end();
        return;
    }

    if (isMainStream) {
        stream.isLive = true;
        const qualities = ['144p', '240p', '360p', '480p', '720p', '1080p'];
        stream.qualities.splice(0, stream.qualities.length);
        qualities.forEach((quality) => {
            stream.qualities.push({
                isSource: false,
                status: 'prepare',
                quality: quality,
            });
        });
        stream.qualities.push({
            isSource: true,
            status: 'offline',
            quality: 'source',
        });
        await stream.save();
        res.status(200).end();

        logger.trace(`[REQUEST] Sending event to transcoder. URL: ${TRANSCODER_SERVICE_ADDRESS}/api/transcoder/start`);
        const response = await buildServiceRequest(TRANSCODER_SERVICE_ADDRESS, `/api/transcoder/start`, {
            method: "POST",
            body: {
                userId: userId,
                source: name,
            },
        });

        if (response.status !== 200) {
            logger.debug(`[REJECT] Failed to send event to transcoder: ${name}`);
        } else {
            logger.debug(`[TRANSCODER] ${name} -> ${userId}-public_source`);
        }
        
        return;
    } else {
        const qualityObj = stream.qualities.find((q) => q.quality === quality);
        if (!qualityObj) {
            logger.debug(`[REJECT] Invalid stream key: ${name}`);
            res.status(403).end();
            return;
        }
        if (qualityObj.status == 'live') {
            logger.debug(`[REJECT] Stream already live: ${name}`);
            res.status(403).end();
            return;
        }
        logger.debug(`[TRANSCODER] ${name} -> ${userId}-${quality}`);
        qualityObj.status = 'live';
    }
    await stream.save();

    logger.debug(`[STREAM STARTED] ${name}`);
    res.status(200).end();
});

router.post('/on_stop', async (req, res) => {
    const name = req.body.name as string;
    if (!name) {
        logger.debug(`[REJECT] Invalid stream key: ${name}`);
        res.status(403).end();
        return;
    }
    // name is: userId-key or userId-key_quality
    const [userId, key] = name.split('-');
    const isMainStream = key.split('_').length === 1;
    const quality = isMainStream ? null : key.split('_')[1];

    logger.trace(`[STREAM STOP] ${name} isMainStream: "${isMainStream}" quality: "${quality}"`);

    const stream = await StreamModel.findOne({ userId: userId });
    if (!stream) {
        logger.debug(`[REJECT] Invalid stream key: ${name}. User not found`);
        res.status(403).end();
        return;
    }

    if (isMainStream) {
        stream.isLive = false;
        stream.qualities.forEach((q) => {
            q.status = 'offline';
        });
        await stream.save();
        logger.debug(`[STREAM STOPPED] Main stream stopped: ${name}`);
    } else {
        const qualityObj = stream.qualities.find((q) => q.quality === quality);
        if (!qualityObj) {
            logger.debug(`[REJECT] Invalid stream key: ${name}`);
            res.status(403).end();
            return;
        }
        qualityObj.status = 'offline';
        await stream.save();
        logger.debug(`[STREAM STOPPED] Quality stream stopped: ${name}`);
    }

    res.status(200).end();
});

export default router;