import mongoose from 'mongoose';
import { StreamModel } from '../models/StreamModel';
import { logger } from '@yourstream/core/index.js';

function buildConnectionString() {
    let connectionString = "mongodb://"
    if (process.env.MONGO_PASSWORD != "") {
        connectionString += `${process.env.MONGO_USER}:${process.env.MONGO_PASSWORD}@`
    }
    connectionString += `${process.env.MONGO_HOST}:${process.env.MONGO_PORT}/${process.env.MONGO_DB}`;
    return connectionString;
}

export async function connect() {
    try {
        await mongoose.connect(buildConnectionString());
    } catch (error) {
        logger.error('Error connecting to MongoDB:', error);
        throw error;
    }
}

export async function testDataset() {
    try {
        const stream = await StreamModel.countDocuments();
        if (stream > 0) {
            logger.info(`[INFO] Stream dataset is not empty: ${stream} documents`);
            return;
        }
        // create a new document
        const newStream = new StreamModel({
            userId: new mongoose.Types.ObjectId(),
            streamKey: 'test',
            isLive: false,
            qualities: []
        });
        await newStream.save();
        logger.info('[INFO] Stream dataset is empty, created a new document');

    } catch (error) {
        logger.error('Error testing dataset:', error);
        throw error;
    }
}


export default {
    testDataset,
    connect,
    StreamModel
}
