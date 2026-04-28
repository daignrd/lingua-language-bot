import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config.ts';

// Initialize Gemini for embeddings
const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

/**
 * Generates a 768-dimensional vector embedding for the given text using Gemini's text-embedding-004.
 */
export async function getEmbedding(text: string): Promise<number[]> {
    if (!config.gemini.apiKey) {
        throw new Error('GEMINI_API_KEY is required for generating embeddings. Please add it to your .env file.');
    }

    try {
        const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
        const result = await model.embedContent(text);

        return result.embedding.values;
    } catch (error) {
        console.error('Failed to generate embedding with Gemini:', error);
        throw error;
    }
}
