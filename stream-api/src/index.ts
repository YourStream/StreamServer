import express from 'express';
import { createClient } from 'redis';

const { REDIS_HOST } = process.env;
if (!REDIS_HOST) {
    console.error('REDIS_HOST environment variable is not set');
    process.exit(1);
}

const app = express();
app.use(express.urlencoded({ extended: true }));

const redis = createClient({ url: `redis://${REDIS_HOST}:6379` });
redis.connect().then(() => {
    console.log('Connected to Redis');
    processQueue();
}).catch((err) => {
    console.error('Error connecting to Redis:', err);
    process.exit(1);
});

const VALID_KEYS: Record<string, string> = {
    'user123': 'secret123',
    'user456': 'secret456',
};

const allowedKeys = new Set(Object.values(VALID_KEYS));

app.post('/on_publish', (req, res) => {
    const name = req.body.name; // stream key
    const [userId, key] = name.split('-');

    if(allowedKeys.has(name)) {
        console.log(`[ACCEPT] Stream key: ${name}`);
        res.status(200).end();
        return;
    }

    if (!VALID_KEYS[userId] || VALID_KEYS[userId] !== key) {
        console.log(`[REJECT] Invalid stream key: ${name}`);
        res.status(403).end();
        return;
    }

    console.log(`[STREAM STARTED] ${name}`);
    res.status(200).end();
});

app.get('/origen', (req, res) => {
    const { user } = req.query;

    console.log(`[REQUESTED] ${user}`);

    if (!user) {
        res.status(400).send('Missing user parameter');
        return;
    }
    const streamKey = VALID_KEYS[user as string];
    if (!streamKey) {
        res.status(404).send('User not found');
        return;
    }
    console.log(`[REQUESTED] ${user}`);
    res.status(200).send(streamKey);
});

app.listen(3000, () => {
    console.log('Stream API listening on port 3000');
});

async function processQueue() {
    while (true) {
        const data = await redis.brPop(`stream:keys:allow`, 0);
        if (!data) continue;
        //user: userId, publicKey: publicKey, quality: quality
        const task = JSON.parse(data.element);
        const { user, publicKey, quality } = task;
        const streamKey = VALID_KEYS[user];
        if (!streamKey) {
            console.error(`[ERROR] Stream key not found for user: ${user}`);
            continue;
        }
        const outputKey = `${publicKey}_${quality}`;
        allowedKeys.add(outputKey);
        console.log(`[ALLOWED] ${user} @ ${quality}`);
    }
}
