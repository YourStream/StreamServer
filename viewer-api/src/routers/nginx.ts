import { Router } from "express";
import { logger } from "@yourstream/core/index.js";

const router = Router();

const { STREAM_API_HOST } = process.env;
if (!STREAM_API_HOST) {
    throw new Error("STREAM_API_HOST is not set");
}

router.get('/start', async (req, res) => {
    const splitUrl = req.url?.split('?');
    if (!splitUrl || splitUrl.length < 2) {
        logger.trace(`Missing URI`);
        res.status(400).send('Missing URI');
        return;
    }
    const uri = splitUrl[1];
    if (!uri) {
        logger.trace(`Missing URI`);
        res.status(400).send('Missing URI');
        return;
    }
    logger.trace(`[REQUESTED] ${uri}`);
    // /hls/user123-public_640x360.m3u8
    const match = uri.match(/^\/hls\/(([^_]+)-public)_([^.]+)\.m3u8$$/);
    if (match) {
        // calculate the userId
        const [, , userId, quality] = match;

    }
    // /hls/681a8043e1c551b41d738fec-public_720p.m3u8,
    // 681a8043e1c551b41d738fec-public,
    // 681a8043e1c551b41d738fec,
    // 720p
    
    res.status(204).end();
});

export default router;