
import { logger } from '@yourstream/core/index.js';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';

export type TranscoderProcessRegisterType = {
    name: string;
    pid: number;
    startTime: number;
    process: ChildProcessWithoutNullStreams;
    processQualities: { name: string, resolution: string }[];
}

class TranscoderProcessRegister {
    private static instance: TranscoderProcessRegister;
    private processMap: Map<string, TranscoderProcessRegisterType> = new Map();

    private constructor() { }

    public static getInstance(): TranscoderProcessRegister {
        if (!TranscoderProcessRegister.instance) {
            TranscoderProcessRegister.instance = new TranscoderProcessRegister();
        }
        return TranscoderProcessRegister.instance;
    }

    public add(name: string, process: ChildProcessWithoutNullStreams, processQualities: { name: string, resolution: string }[]): void {
        const processInfo: TranscoderProcessRegisterType = {
            name,
            pid: process.pid || -1,
            startTime: Date.now(),
            process: process,
            processQualities: processQualities,
        };
        this.processMap.set(name, processInfo);
        process.on('exit', (code) => {
            this.processMap.delete(name);
            logger.info(`[INFO] Process ${name} exited with code ${code}`);
        });
    }

    public get(name: string): TranscoderProcessRegisterType | undefined {
        return this.processMap.get(name);
    }

    public remove(name: string): boolean {
        const processInfo = this.processMap.get(name);
        if (processInfo) {
            processInfo.process.kill();
            this.processMap.delete(name);
            logger.info(`[INFO] Process ${name} killed`);
            return true;
        } else {
            logger.info(`[INFO] Process ${name} not found`);
            return false;
        }
    }

}

export default TranscoderProcessRegister.getInstance();