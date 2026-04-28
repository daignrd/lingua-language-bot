import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config.ts';

const genAI = new GoogleGenerativeAI(config.gemini.apiKey);

/**
 * Analyzes an image and returns a text description.
 */
export async function analyzeImage(mimeType: string, base64Data: string): Promise<string> {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = 'Please describe this image in detail. Extract any relevant text, entities, context, and meaning. Be extremely thorough as this will be saved to my memory.';

    const imageParts = [
        {
            inlineData: {
                data: base64Data,
                mimeType
            }
        }
    ];

    const result = await model.generateContent([prompt, ...imageParts]);
    return result.response.text();
}

/**
 * Analyzes a document and returns a text description.
 */
export async function analyzeDocument(mimeType: string, base64Data: string): Promise<string> {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = 'Please analyze this document. Summarize its contents, extract any key facts, themes, and important details. Be thorough as this will be saved to my long term memory.';

    const documentParts = [
        {
            inlineData: {
                data: base64Data,
                mimeType
            }
        }
    ];

    const result = await model.generateContent([prompt, ...documentParts]);
    return result.response.text();
}
