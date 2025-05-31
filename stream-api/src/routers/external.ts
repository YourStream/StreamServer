import { Router } from "express";
import { StreamModel } from "../models/StreamModel";
import { guard } from '@yourstream/core/userAuthVerifier.js';
import { YourStreamRequest } from "@yourstream/core/models/request.js";

const router = Router();

router.get('/:userId', async (req, res) => {
    const userId = req.params.userId;
    if (!userId) {
        res.status(400).send('User ID is required');
        return;
    }
    const stream = await StreamModel.findOne({ _id: userId });
    if (!stream) {
        res.status(404).send('Stream not found');
        return;
    }
    res.status(200).send(stream.toResponse());
});

router.get('/:userId/short', async (req, res) => {
    const userId = req.params.userId;
    if (!userId) {
        res.status(400).send('User ID is required');
        return;
    }
    const stream = await StreamModel.findOne({ _id: userId });
    if (!stream) {
        res.status(404).send('Stream not found');
        return;
    }
    res.status(200).send(stream.toShortResponse());
});

router.put('/', guard, async (req: YourStreamRequest, res) => {
    const userId = req.user?.userId;
    if (!userId) {
        res.status(401).send('Unauthorized');
        return;
    }
    const { title, description } = req.body;

    if (!title || !description) {
        res.status(400).send('title, and description are required');
        return;
    }

    const stream = await StreamModel.findOne({ _id: userId });
    if (!stream) {
        res.status(404).send('Stream not found');
        return;
    }
    stream.title = title;
    stream.description = description;
    await stream.save();
    res.status(200).send(stream.toResponse());
});

export default router;