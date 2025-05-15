import { logger } from "@yourstream/core/index.js";
import { serviceAuthGuard } from "@yourstream/core/serviceAuthVerifier.js";
import { Router } from "express";
import { exec, spawn } from 'child_process';
import util from 'util';
import fs from 'fs';

const router = Router();
const execPromise = util.promisify(exec);

const ORIGINAL_RTMP_SERVER = `rtmp://${process.env.ORIGINAL_RTMP_SERVER}/live`;
if (!process.env.ORIGINAL_RTMP_SERVER) {
    logger.error('[ERROR] Missing ORIGINAL_RTMP_SERVER environment variable');
    process.exit(1);
}

const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
const qualities: { name: string, resolution: string, videoBitrate: string, audioBitrate: string }[] = config.qualities;
const splitCount = qualities.length;
const splitLabels = qualities.map((q, i) => `[v${i}]`).join('');
const scaleFilters = qualities.map((q, i) => `[v${i}]scale=${q.resolution}[vout${i}]`).join('; ');
const filterComplex = `[0:v]split=${splitCount}${splitLabels}; ${scaleFilters}`;

router.post('/start', serviceAuthGuard, async (req, res) => {
    const { userId, source } = req.body;
    if (!userId || !source) {
        logger.trace(`[REJECT] Missing parameters: userId: ${userId}, source: ${source}`);
        res.status(400).send('Missing parameters');
        return;
    }
    logger.trace(`[TRANSCODE] userId: ${userId}, source: ${source}`);

    const inputUrl = `${ORIGINAL_RTMP_SERVER}/${source}`;

    const args: string[] = [
        '-y',
        '-analyzeduration', '10000000',
        '-probesize', '10000000',
        '-i', inputUrl,
        '-filter_complex', filterComplex,
    ];

    qualities.forEach((q, i) => {
        if (!fs.existsSync(`/tmp/hls/${userId}/${q.name}`)) {
            fs.mkdirSync(`/tmp/hls/${userId}/${q.name}`, { recursive: true });
        }
        args.push(
            '-map', `[vout${i}]`,
            '-map', 'a',
            `-c:v:${i}`, 'libx264',
            `-b:v:${i}`, q.videoBitrate,
            `-c:a:${i}`, 'aac',
            `-b:a:${i}`, q.audioBitrate,
            '-strict', '-2',
            '-f', 'hls',
            '-hls_time', '4',
            '-hls_list_size', '6',
            '-hls_flags', 'delete_segments+omit_endlist',
            '-hls_segment_filename', `/tmp/hls/${userId}/${q.name}/segment_%03d.ts`,
            `/tmp/hls/${userId}/${q.name}/index.m3u8`,
        );
    });

    logger.debug(`[FFMPEG COMMAND] ffmpeg ${args.join(' ')}`);

    // wait for the stream to be available
    const streamReady = await waitForStream(inputUrl);
    if (!streamReady) {
        logger.error(`[ERROR] Stream not ready: ${inputUrl}`);
        res.status(500).send('Stream not ready');
        return;
    }
    logger.info(`[START] Starting transcoding from ${inputUrl}`);
    try {
        // start the ffmpeg process
        const ffmpeg = spawn('ffmpeg', args);
        ffmpeg.stderr.on('data', (data) => {
            logger.debug(`[FFMPEG STDERR] ${data}`);
        });
        ffmpeg.stdout.on('data', (data) => {
            logger.debug(`[FFMPEG STDOUT] ${data}`);
        });
        ffmpeg.on('error', (error) => {
            logger.error(`[ERROR] Failed to start transcoding: ${error}`);
        });
        ffmpeg.on('close', (code) => {
            if (code !== 0) {
                logger.error(`[ERROR] Transcoding process exited with code ${code}`);
            } else {
                logger.info(`[SUCCESS] Transcoding process exited successfully`);
            }
        });
        logger.info(`[SUCCESS] Transcoding started from ${inputUrl}`);
        res.status(200).send('Transcoding started');
    }
    catch (error) {
        logger.error(`[ERROR] Failed to start transcoding: ${error}`);
        res.status(500).send('Failed to start transcoding');
    }
});

router.post('/on_publish_done', async (req, res) => {
    const name = req.body.name as string;
    if (!name) {
        logger.debug(`[REJECT] Invalid stream key: ${name}`);
        res.status(403).end();
        return;
    }
    const [userId, key] = name.split('-');
    const isMainStream = key.split('_').length === 1;
    const quality = isMainStream ? null : key.split('_')[1];
    const outputDir = `/tmp/hls/${userId}`;

    const inputUrl = `${ORIGINAL_RTMP_SERVER}/live/${name}`;

    logger.trace(`[TRANSCODE] userId: ${userId}, source: ${inputUrl}`);
    logger.trace(`[TRANSCODE] inputUrl: ${inputUrl}`);
    logger.trace(`[TRANSCODE] outputDir: ${outputDir}`);

    const args: string[] = [
        '-i', inputUrl,
    ];
    qualities.forEach((q, i) => {
        args.push(
            `-filter:v:${i}`, `scale=w=${q.resolution.split('x')[0]}:h=${q.resolution.split('x')[1]}`,
            `-c:v:${i}`, 'libx264',
            `-b:v:${i}`, q.videoBitrate,
            `-map`, `0:v:${i}`,
            `-map`, `0:a:0`
        );
    });

    args.push(
        '-preset', 'veryfast',
        '-f', 'hls',
        '-hls_time', '4',
        '-hls_playlist_type', 'event',
        '-master_pl_name', 'index.m3u8',
        '-hls_segment_filename', `${outputDir}/v%v/fileSequence%d.ts`,
        '-var_stream_map', qualities.map((_, i) => `v:${i},a:${i}`).join(' '),
        `${outputDir}/v%v/index.m3u8`
    );

    const ffmpeg = spawn('ffmpeg', args);

    ffmpeg.stderr.on('data', data => console.error(`[FFmpeg ${name}]`, data.toString()));
    ffmpeg.on('close', code => console.log(`[FFmpeg ${name}] exited with code ${code}`));

    res.send('Transcoding started');
});

async function waitForStream(rtmpUrl: string, delayMs = 1000): Promise<{ hasVideo: boolean; hasAudio: boolean }> {
    let attempt = 0;
    while (true) {
        attempt++;
        try {
            const { stdout } = await execPromise(`ffprobe -v error -analyzeduration 10000000 -probesize 10000000 -show_streams -of json ${rtmpUrl}`);
            const streams = JSON.parse(stdout).streams;

            const hasVideo = streams.some((stream: any) => stream.codec_type === 'video');
            const hasAudio = streams.some((stream: any) => stream.codec_type === 'audio');

            logger.debug(`[FFPROBE] Stream info: hasVideo=${hasVideo}, hasAudio=${hasAudio}, streams=${JSON.stringify(streams)}`);

            if (hasVideo && hasAudio) {
                logger.debug(`[WAITING] Stream is ready in ${rtmpUrl} (attempt ${attempt})`);
                return { hasVideo, hasAudio };
            } else {
                throw new Error('No video or audio stream found');
            }
        } catch (error: any) {
            logger.debug(`[WAITING] Stream not ready in ${rtmpUrl} (attempt ${attempt}): ${error.message}`);
            await new Promise((r) => setTimeout(r, delayMs));
        }
    }
}

export default router;
