import { Router } from "express";
import { StreamModel } from "../models/StreamModel";
import { logger } from "@yourstream/core/index.js";
import { buildServiceRequest, serviceAuthGuard } from "@yourstream/core/serviceAuthVerifier.js";

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

    const [userId, key] = name.split('-');

    logger.trace(`[STREAM] UserId: ${userId} starting`);

    const stream = await StreamModel.findOne({ userId: userId });
    if (!stream) {
        logger.debug(`[REJECT] Invalid stream key: ${name}. User not found`);
        logger.trace(`[REJECT] UserId: "${userId}" key: "${key}"`);
        res.status(403).end();
        return;
    }

    if (stream.streamKey !== key) {
        logger.debug(`[REJECT] Invalid stream key: ${name}`);
        res.status(403).end();
        return;
    }

    if (stream.isLive) {
        logger.debug(`[REJECT] Stream already live: ${name}`);
        res.status(403).end();
        return;
    }

    stream.isLive = true;
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
});

router.post('/on_publish_done', async (req, res) => {
    const name = req.body.name as string;
    if (!name) {
        logger.debug(`[REJECT] Invalid stream key: ${name}`);
        res.status(403).end();
        return;
    }

    const [userId, key] = name.split('-');

    const stream = await StreamModel.findOne({ userId: userId });
    if (!stream) {
        logger.debug(`[REJECT] Invalid stream key: ${name}. User not found`);
        res.status(403).end();
        return;
    }

    if (stream.streamKey !== key) {
        logger.debug(`[REJECT] Invalid stream key: ${name}`);
        res.status(403).end();
        return;
    }
    if (!stream.isLive) {
        logger.debug(`[REJECT] Stream not live: ${name}`);
        res.status(403).end();
        return;
    }

    stream.isLive = false;

    await stream.save();

    await buildServiceRequest(TRANSCODER_SERVICE_ADDRESS, `/api/transcoder/stop`, {
        method: "POST",
        body: {
            userId: userId,
        },
    });

    res.status(200).end();
    logger.trace(`[STREAM STOP] ${name}`);
});

router.post('/set_source_info', serviceAuthGuard, async (req, res) => {
    const userId = req.body.userId as string;
    const width = req.body.width as number;
    const height = req.body.height as number;
    const display_aspect_ratio = req.body.display_aspect_ratio as string;
    const qualities = req.body.qualities as {name: string, resolution: string}[];
    if (!userId || !width || !height || !display_aspect_ratio || !qualities) {
        logger.debug(`[REJECT] Invalid parameters: ${JSON.stringify(req.body)}`);
        res.status(400).end();
        return;
    }

    logger.trace(`[SET SOURCE INFO] userId: ${userId} width: ${width} height: ${height} display_aspect_ratio: ${display_aspect_ratio}`);

    const stream = await StreamModel.findOne({ userId: userId });
    if (!stream) {
        logger.debug(`[REJECT] Invalid stream key: ${userId}. User not found`);
        res.status(403).end();
        return;
    }

    stream.source.width = width;
    stream.source.height = height;
    stream.source.display_aspect_ratio = display_aspect_ratio;
    stream.source.qualities.splice(0, stream.source.qualities.length);
    for (const quality of qualities) {
        stream.source.qualities.push({
            name: quality.name,
            height: parseInt(quality.resolution.split('x')[1]),
            width: parseInt(quality.resolution.split('x')[0]),
        });
    }

    await stream.save();
    res.status(200).end();
});

export default router;