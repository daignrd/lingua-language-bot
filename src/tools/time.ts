import type { RunnableToolFunction } from 'openai/lib/RunnableFunction';

export const getCurrentTimeToolDefinition = {
    type: 'function' as const,
    function: {
        name: 'get_current_time',
        description: 'Returns the current local date and time. Useful when you need to know what time it is.',
        parameters: {
            type: 'object',
            properties: {},
        },
    },
};

export function executeGetCurrentTime(): string {
    const now = new Date();
    return `The current local time is: ${now.toLocaleString()}`;
}
