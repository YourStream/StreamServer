const os = require('os');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');

const OS_TYPE = os.type();
const FFMPEG_DOWNLOAD_URL = {
    Windows_NT: 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-full.7z'
}

exec('ffmpeg -version', (error) => {
    if (error) {
        setup();
    } else {
        console.log('FFMPEG already installed');
    }
});

const download = (url, dest) => {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            response.pipe(file);
            // show progress of download in percentage
            let len = parseInt(response.headers['content-length'], 10);
            let cur = 0;
            let total = len / 1048576; //1048576 - bytes in 1Megabyte
            response.on('data', (chunk) => {
                cur += chunk.length;
                process.stdout.write(`Downloading ${(100.0 * cur / len).toFixed(2)}% ${cur / 1048576} Mb out of ${total.toFixed(2)} Mb\r`);
            });
            file.on('finish', () => {
                file.close(resolve(true));
            });
        }).on('error', (err) => {
            fs.unlink(dest);
            reject(err.message);
        });
    }
    );
}

const extract = (src, dest) => {
    return new Promise((resolve, reject) => {
        const extract = require('extract-zip');
        extract(src, { dir: dest }, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve(true);
            }
        });
    });
}

const downloadAndExtract = async (url, dest) => {
    try {
        await download(url, dest);
        await extract(dest, path.dirname(dest));
    } catch (err) {
        console.error(err);
    }
}

const setupFFMPEGForWindows = async () => {
    await downloadAndExtract(FFMPEG_DOWNLOAD_URL.Windows_NT, path.join(__dirname, 'ffmpeg.7z'));
    console.log('FFMPEG setup done');
}

const setupFFMPEGForLinux = () => {
    return new Promise((resolve, reject) => {
        console.log('Installing FFMPEG on Linux...');
        exec('sudo apt-get install ffmpeg -y', (error, stdout, stderr) => {
            if (error) {
                reject(error);
            }
            resolve(true);
            console.log('FFMPEG setup done');
        });
    });
}

const setup = async () => {
    if(OS_TYPE === 'Windows_NT') {
        await setupFFMPEGForWindows();
    } else if(OS_TYPE === 'Linux') {
        await setupFFMPEGForLinux();
    } else {
        console.error('OS not supported');
    }
}