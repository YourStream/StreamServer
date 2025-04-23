import { createClient } from 'redis';
import { exec } from 'child_process';
import util from 'util';

type TranscodeTask = {
    user: string;
    streamKey: string;
    publicKey: string;
};

const QUALITY = process.env.QUALITY!;
const REDIS_HOST = process.env.REDIS_HOST!;
const RTMP_SERVER = `rtmp://${process.env.RTMP_SERVER}/live` || 'rtmp://localhost/live';

const redis = createClient({ url: `redis://${REDIS_HOST}:6379` });
const execPromise = util.promisify(exec);

// list of stream keys
const streamKeys = new Set<string>();

redis.connect().then(() => {
    console.log(`[TRANSCODER ${QUALITY}] Connected to Redis`);
    listen();
});

async function waitForStream(rtmpUrl: string, retries = 10, delayMs = 1000): Promise<boolean> {
    for (let i = 0; i < retries; i++) {
        try {
            await execPromise(`ffprobe -v error -i ${rtmpUrl}`);
            return true;
        } catch {
            console.log(`[WAITING] ${rtmpUrl} not ready (${i + 1}/${retries})`);
            await new Promise((r) => setTimeout(r, delayMs));
        }
    }
    return false;
}

async function listen() {
    while (true) {
        const data = await redis.brPop(`transcode:${QUALITY}`, 0);
        if (!data) continue;

        const task: TranscodeTask = JSON.parse(data.element);
        const inputUrl = `${RTMP_SERVER}/${task.user}-${task.streamKey}`;
        const outputKey = `${task.publicKey}_${QUALITY}`;
        const outputUrl = `${RTMP_SERVER}/${outputKey}`;

        if (streamKeys.has(outputKey)) {
            console.log(`[ALREADY RUNNING] ${task.streamKey} -> ${QUALITY}`);
            continue;
        }

        console.log(`[TASK RECEIVED] ${task.streamKey} -> ${QUALITY}`);

        const available = await waitForStream(inputUrl);
        if (!available) {
            console.error(`[TIMEOUT] Stream ${inputUrl} not available.`);
            continue;
        }

        const cmd = `ffmpeg -y -i ${inputUrl} -c:v libx264 -b:v 1000000 -s ${QUALITY} -f flv ${outputUrl}`;
        console.log(`[STARTING FFMPEG] ${cmd}`);

        streamKeys.add(outputKey);
        exec(cmd, (err) => {
            if (err) {
                console.error(`[FFMPEG ERROR ${QUALITY}]`, err.message);
                streamKeys.delete(outputKey);
                return;
            }
        });
    }
}
