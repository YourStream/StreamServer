import { Router } from "express";
import { StreamModel } from "../models/StreamModel";
import { guard } from '@yourstream/core/userAuthVerifier.js';
import { YourStreamRequest } from "@yourstream/core/models/request.js";
import { buildServiceRequest } from "@yourstream/core/serviceAuthVerifier.js";
import { logger } from "@yourstream/core/index.js";

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

router.get('/', guard, async (req: YourStreamRequest, res) => {
    const userId = req.user?.userId;
    if (!userId) {
        res.status(401).send('Unauthorized');
        return;
    }
    const stream = await StreamModel.findOne({ _id: userId });
    if (!stream) {
        res.status(404).send('Stream not found');
        return;
    }
    res.status(200).send(stream.toResponse());
});

router.put('/', guard, async (req: YourStreamRequest, res) => {
    const userId = req.user?.userId;
    if (!userId) {
        res.status(401).send('Unauthorized');
        return;
    }
    const { title, description, tags } = req.body;

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
    if (Array.isArray(tags)) {
        stream.tags = tags; // Зберігаємо теги у стрімі
        try {
            const searchServiceUrl = process.env.SEARCH_SERVICE_ADDRESS;
            if (searchServiceUrl) {
                await buildServiceRequest(
                    searchServiceUrl,
                    "/api/search",
                    {
                        method: "POST",
                        body: {
                            tags,
                            streamId: stream._id.toString(),
                            streamTitle: stream.title
                        }
                    }
                );
            }
        } catch (e) {
            logger.error("Failed to update tags in search-service:", e);
        }
    }

    await stream.save();
    res.status(200).send(stream.toResponse());
});

export default router;