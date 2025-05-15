import { config } from 'dotenv';
config();
import express from 'express';
import { logger, serviceAuthVerifier } from '@yourstream/core/index.js';
import nginxRouter from './routers/nginx';

const PORT = process.env.PORT || 3000;
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/nginx', nginxRouter);

app.use((req, res, next) => {
    logger.trace(`[REQUEST] ${req.method} ${req.url}`);
    next();
});

(async () => {
    if (!process.env.SERVICE_NAME || !process.env.SERVICE_SECRET || !process.env.AUTH_SERVICE_ADDRESS) {
        logger.error('[ERROR] Missing environment variables: SERVICE_NAME, SERVICE_SECRET, AUTH_SERVICE_ADDRESS');
        process.exit(1);
    }

    const authVerifierState = await serviceAuthVerifier.connect(process.env.SERVICE_NAME as string, process.env.SERVICE_SECRET as string, process.env.AUTH_SERVICE_ADDRESS as string);
    if (!authVerifierState) {
        process.exit(1);
    }

    app.listen(PORT, () => {
        logger.info(`[INFO] Transcoder service is running on port ${PORT}`);
    });
})();