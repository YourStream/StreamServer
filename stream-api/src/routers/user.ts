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

export default router;