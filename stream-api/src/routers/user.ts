import { serviceAuthGuard } from "@yourstream/core/serviceAuthVerifier.js";
import { Router } from "express";
import { StreamModel } from "../models/StreamModel";
import * as stringUtils from "../utils/string";

const router = Router();

router.get('/stream-key', serviceAuthGuard, async (req, res) => {
    const { userId } = req.body;

    const stream = await StreamModel.findOne({ userId: userId });
    if (!stream) {
        res.status(404).send('User not found');
        return;
    }

    res.status(200).send(stream.streamKey);
});

router.get('/qualities', async (req, res) => {
    const { userId } = req.query;
    if (!userId) {
        res.status(400).send('User ID is required');
        return;
    }

    const stream = await StreamModel.findOne({ userId: userId });
    if (!stream) {
        res.status(404).send('User not found');
        return;
    }

    res.status(200).send(stream.source.qualities);
});

router.post('/create', serviceAuthGuard, async (req, res) => {
    const { userId } = req.body;
    if (!userId) {
        res.status(400).send('User ID is required');
        return;
    }
    const stream = await StreamModel.findOne({ userId: userId });
    if (stream) {
        res.status(400).send('Stream already exists');
        return;
    }
    const newStream = new StreamModel({
        userId: userId,
        streamKey: `${userId}-${Date.now()}${stringUtils.random(64)}`,
        isLive: false,
        source: {
            width: 0,
            height: 0,
            display_aspect_ratio: '0:0',
            qualities: []
        }
    });
    await newStream.save();
    res.status(201).send(newStream);
});

router.post('/stream-key/update', serviceAuthGuard, async (req, res) => {
    const { userId } = req.body;
    if (!userId) {
        res.status(400).send('User ID is required');
        return;
    }
    const stream = await StreamModel.findOne({ userId: userId });
    if (!stream) {
        res.status(404).send('Stream not found');
        return;
    }
    stream.streamKey = `${userId}-${Date.now()}${stringUtils.random(64)}`;
    await stream.save();
    res.status(200).send(stream.streamKey);
});

export default router;