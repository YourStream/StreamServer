import { serviceAuthGuard } from "@yourstream/core/serviceAuthVerifier.js";
import { Router } from "express";
import { StreamModel } from "../models/StreamModel";

const router = Router();

router.get('/origen', serviceAuthGuard, async (req, res) => {
    const { id } = req.query;

    const stream = await StreamModel.findOne({ userId: id });
    if (!stream) {
        res.status(404).send('User not found');
        return;
    }

    res.status(200).send(stream.streamKey);
});

router.get('/quality', serviceAuthGuard, async (req, res) => {
    const { id } = req.query;

    const stream = await StreamModel.findOne({ userId: id });
    if (!stream) {
        res.status(404).send('User not found');
        return;
    }

    const qualities = stream.qualities.map((quality) => {
        return {
            status: quality.status,
            isSource: quality.isSource,
            quality: quality.quality,
            rtmp: `/live/${stream.userId}-public_${quality.quality}`,
            url: `/hls/public-${stream.userId}_${quality.quality}.m3u8`
        };
    });
    
    res.status(200).send(qualities);
});

router.get('/stream', serviceAuthGuard, async (req, res) => {
    const { id } = req.query;

    const stream = await StreamModel.findOne({ userId: id });
    if (!stream) {
        res.status(404).send('User not found');
        return;
    }

    res.status(200).send({
        isLive: stream.isLive,
        qualities: stream.qualities.map((quality) => {
            return {
                status: stream.isLive,
                quality: quality,
                rtmp: `${process.env.RTMP_SERVER}/live/${stream.userId}_${quality}`,
                url: `${process.env.STREAM_API_HOST}/hls/public-${stream.userId}_${quality}.m3u8`
            };
        })
    });
});

export default router;