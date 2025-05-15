import { logger } from "@yourstream/core/index.js";
import { buildServiceRequest } from "@yourstream/core/serviceAuthVerifier.js";

const TRANSCODER_SERVICE_ADDRESS = process.env.TRANSCODER_SERVICE_ADDRESS as string;
if (!TRANSCODER_SERVICE_ADDRESS) {
    throw new Error("TRANSCODER_SERVICE_ADDRESS is not set");
}

async function startStream(userId: string, source: string, destination: string, destinationQuality: string) {
    logger.trace(`[REQUESTED][startStream] ${userId} ${source} ${destination} ${destinationQuality}`);
    const response = await buildServiceRequest(TRANSCODER_SERVICE_ADDRESS, "/api/transcoder/start",{
        method: "POST",
        body: {
            userId: userId,
            source: source,
            destination: destination,
            destinationQuality: destinationQuality,
        },
    });
    const data = await response.text();
    if (!data) {
        logger.trace(`[REJECT][startStream] Transcoder response not found`);
        throw new Error("Transcoder response not found");
    }
    logger.trace(`[REQUESTED][startStream] ${data}`);
    return {
        status: response.status,
        data: data,
    }
}

export { startStream };