import { logger } from "@yourstream/core/index.js";
import { buildServiceRequest, serviceAuthGuard } from "@yourstream/core/serviceAuthVerifier.js";
import { Router } from "express";
import { exec, spawn } from 'child_process';
import util from 'util';
import fs from 'fs';
import transcoderProcessRegister from "../services/transcoderProcessRegister";

const router = Router();
const execPromise = util.promisify(exec);

const STREAM_API_HOST = process.env.STREAM_API_HOST as string;
if (!STREAM_API_HOST) {
    logger.error('[ERROR] Missing STREAM_API_HOST environment variable');
    process.exit(1);
}

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

    // wait for the stream to be available
    const streamReady = await waitForStream(inputUrl);
    if (!streamReady) {
        logger.error(`[ERROR] Stream not ready: ${inputUrl}`);
        res.status(500).send('Stream not ready');
        return;
    }

    const args: string[] = [
        '-y',
        '-analyzeduration', '10000000',
        '-probesize', '10000000',
        '-i', inputUrl,
        '-filter_complex', filterComplex,
    ];

    const processQualities: { name: string, resolution: string }[] = [];

    qualities.forEach((q, i) => {

        const height = parseInt(q.resolution.split('x')[1]);
        if (streamReady.video.height < height) {
            logger.trace(`[REJECT] Resolution ${q.resolution} is larger than the original stream resolution ${streamReady.video.height}`);
            return;
        }
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
        processQualities.push({ name: q.name, resolution: q.resolution });
    });

    logger.debug(`[FFMPEG COMMAND] ffmpeg ${args.join(' ')}`);


    logger.info(`[START] Starting transcoding from ${inputUrl}`);
    try {
        // start the ffmpeg process
        const ffmpeg = spawn('ffmpeg', args);

        transcoderProcessRegister.add(`${userId}`, ffmpeg, processQualities);

        ffmpeg.stderr.on('data', (data) => {
            logger.trace(`[FFMPEG STDERR] ${data}`);
        });
        ffmpeg.stdout.on('data', (data) => {
            logger.trace(`[FFMPEG STDOUT] ${data}`);
        });

        logger.info(`[SUCCESS] Transcoding started from ${inputUrl}`);
        res.status(200).send('Transcoding started');

        buildServiceRequest(STREAM_API_HOST, "/api/stream/set_source_info", {
            method: "POST",
            body: {
                userId: userId,
                width: streamReady.video.width,
                height: streamReady.video.height,
                display_aspect_ratio: streamReady.video.display_aspect_ratio,
                qualities: processQualities,
            },
        }).then((response) => {
            if (response.status !== 200) {
                logger.error(`[ERROR] Failed to set source info: ${response.statusText}`);
            } else {
                logger.info(`[SUCCESS] Source info set for userId: ${userId}`);
            }
        }).catch((error) => {
            logger.error(`[ERROR] Failed to set source info: ${error}`);
        });
    }
    catch (error) {
        logger.error(`[ERROR] Failed to start transcoding: ${error}`);
        res.status(500).send('Failed to start transcoding');
    }
});

router.post('/stop', serviceAuthGuard, async (req, res) => {
    const { userId } = req.body;
    if (!userId) {
        logger.trace(`[REJECT] Missing parameters: userId: ${userId}`);
        res.status(400).send('Missing parameters');
        return;
    }
    logger.trace(`[TRANSCODE] userId: ${userId}`);

    const removeStatus = transcoderProcessRegister.remove(userId);
    if (removeStatus) {
        logger.info(`[STOP] Transcoding stopped for userId: ${userId}`);
        res.status(200).send('Transcoding stopped');
    } else {
        logger.info(`[STOP] No transcoding process found for userId: ${userId}`);
        res.status(404).send('No transcoding process found');
    }
});

async function waitForStream(rtmpUrl: string, delayMs = 1000) {
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
                return {
                    hasVideo, hasAudio, video: {
                        display_aspect_ratio: streams.find((stream: any) => stream.codec_type === 'video').display_aspect_ratio,
                        width: streams.find((stream: any) => stream.codec_type === 'video').width,
                        height: streams.find((stream: any) => stream.codec_type === 'video').height,
                    }
                };
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
