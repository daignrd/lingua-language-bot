import { pushToCanvas } from '../services/canvas.ts';

export const pushToCanvasToolDefinition = {
    type: 'function' as const,
    function: {
        name: 'push_to_canvas',
        description: 'Push interactive HTML/JS widgets, charts, tables, forms to the Live Canvas via WebSocket. Support A2UI.',
        parameters: {
            type: 'object',
            properties: {
                html: { type: 'string', description: 'The HTML string to render on the canvas. It can include inline CSS and JS scripts.' }
            },
            required: ['html']
        }
    }
};

export async function executePushToCanvas(args: any): Promise<string> {
    try {
        pushToCanvas(args.html);
        return 'Successfully pushed to Canvas.';
    } catch (e: any) {
        return `Failed to push to Canvas: ${e.message}`;
    }
}
