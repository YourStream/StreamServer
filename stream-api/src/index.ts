import { config } from 'dotenv';
config();
import express from 'express';
import * as db from './service/db'
import { logger, serviceAuthVerifier } from '@yourstream/core/index.js';
import streamRouter from './routers/stream';
import userRouter from './routers/user';

const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use((req, res, next) => {
    logger.trace(`[REQUEST] ${req.method} ${req.url}`);
    next();
});

app.use('/api/stream', streamRouter);
app.use('/api/user', userRouter);

(async () => {
    if (!process.env.SERVICE_NAME || !process.env.SERVICE_SECRET || !process.env.AUTH_SERVICE_ADDRESS) {
        logger.error('[ERROR] Missing environment variables: SERVICE_NAME, SERVICE_SECRET, AUTH_SERVICE_ADDRESS');
        return;
    }

    logger.info(`[INFO] Connecting to auth service at ${process.env.AUTH_SERVICE_ADDRESS}`);
    logger.info(`[INFO] Service name: ${process.env.SERVICE_NAME}`);
    const authVerifierState = await serviceAuthVerifier.connect(process.env.SERVICE_NAME as string, process.env.SERVICE_SECRET as string, process.env.AUTH_SERVICE_ADDRESS as string);
    if (!authVerifierState) {
        process.exit(1);
    }
    
    await db.connect();
    await db.testDataset();

    app.listen(PORT, () => {
        logger.info(`[INFO] Stream service listening on port ${PORT}`);
    });
})();
