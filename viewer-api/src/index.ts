import express from 'express';
import { createClient } from 'redis';

const { STREAM_API_HOST } = process.env;
if (!STREAM_API_HOST) {
    throw new Error('STREAM_API_HOST is not set');
}
console.log(`STREAM_API_HOST: ${STREAM_API_HOST}`);

const app = express();
const redis = createClient({ url: `redis://${process.env.REDIS_HOST}:6379` });
redis.connect();

const availableQuality: Set<string> = new Set(['256x144', '640x360', '1280x720']);

async function getStreamKey(user: string) {
    const request = await fetch(`http://${STREAM_API_HOST}/origen?user=${user}`);
    if (!request.ok) {
        throw new Error(`Failed to fetch stream key: ${request.statusText}`);
    }
    const streamKey = await request.text();
    if (!streamKey) {
        throw new Error('Stream key not found');
    }
    return streamKey;
}

app.get('/start', async (req, res) => {
    const splitUrl = req.url?.split('?');
    if (!splitUrl || splitUrl.length < 2) {
        res.status(400).send('Missing URI');
        return;
    }
    const uri = splitUrl[1];
    if (!uri) {
        res.status(400).send('Missing URI');
        return;
    }
    console.log(`[REQUESTED] ${uri}`);
    // /hls/public-user123_640x360.m3u8
    const match = uri.match(/^\/hls\/(public-[^_]+)_([^.]+)\.m3u8$/);
    if (!match) {
        res.status(400).send('Invalid URI');
        return;
    }

    const [, publicKey, quality] = match;
    const [, userId] = publicKey.split('-');
    console.log(`[REQUESTED] ${match}`);
    if(!availableQuality.has(quality)) {
        res.status(400).send('Unknown quality');
        return;
    }

    const taskKey = `transcode:${quality}:started:${publicKey}`;
    const already = await redis.get(taskKey);
    if (!already) {
        await redis.set(taskKey, '1', { EX: 60 }); // блокування на хвилину
        const streamKey = await getStreamKey(userId);
        await redis.lPush('stream:keys:allow', JSON.stringify({ user: userId, publicKey: publicKey, quality: quality }));
        await redis.lPush(`transcode:${quality}`, JSON.stringify({ user: userId, streamKey: streamKey, publicKey: publicKey }));
        console.log(`[REQUESTED] ${publicKey} @ ${quality}`);
    }

    res.status(204).end();
});

app.listen(4000, () => console.log('Transcoder API listening on 4000'));
